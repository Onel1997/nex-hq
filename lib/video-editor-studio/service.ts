import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import {
  VIDEO_EDITOR_ANALYSIS_BUDGET_MS,
  VIDEO_EDITOR_CONTRACT_VERSION,
  VIDEO_EDITOR_INVOCATION_BUDGET_MS,
  VIDEO_EDITOR_MAX_OUTPUT_BYTES,
  VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS,
  VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS,
  type VideoEditorManifest,
  type VideoEditorRenderRequest,
  type VideoEditorSource,
} from "./contracts";
import {
  analyzeVideoEditorClipPath,
  assertVideoEditorProcessingSpace,
  inspectVideoEditorMediaPath,
  renderVideoEditorMp4,
  videoEditorExtension,
} from "./ffmpeg";
import {
  SupabaseVideoEditorRenderLeaseStore,
  type VideoEditorRenderLeaseStore,
} from "./lease";
import { createPreparingVideoEditorManifest, transitionVideoEditorManifest } from "./manifest";
import { buildVideoEditorRenderSegments } from "./project";
import { videoEditorScope } from "./scope";
import {
  bindVideoEditorTempSources,
  preflightVideoEditorSources,
  resolveVideoEditorSourceMetadata,
} from "./sources";
import { streamVideoEditorSourceToFile } from "./streaming";
import { SupabaseVideoEditorJobStore, videoEditorFingerprint } from "./storage";

const LIBRARY_BUCKET = "xeriano-library-assets";
const POST_RENDER_RESERVE_MS = 25_000;

function sourceKey(source: VideoEditorSource) {
  return `${source.kind}:${source.id}`;
}

function remaining(deadlineAt: number, reserve = 0) {
  const value = deadlineAt - Date.now() - reserve;
  if (value < 1_000) throw new Error("VIDEO_EDITOR_TIMEOUT");
  return value;
}

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function safeRenderError(error: unknown): VideoEditorManifest["error"] {
  const message = error instanceof Error ? error.message : "VIDEO_EDITOR_RENDER_FAILED";
  if (message === "VIDEO_EDITOR_TIMEOUT") return { code: "TIMED_OUT", message: "Der Export hat das Zeitlimit erreicht. Dein Projekt wurde nicht verändert." };
  if (message === "VIDEO_EDITOR_PROCESSING_SPACE_LOW") return { code: "PROCESSING_SPACE_LOW", message: "Für diesen Export steht gerade nicht genügend Verarbeitungsraum bereit." };
  if (message === "VIDEO_EDITOR_NOT_ENOUGH_VALID_CLIPS") return { code: "NOT_ENOUGH_CLIPS", message: "Für den Export werden mindestens zwei lesbare Clips benötigt." };
  if (message === "VIDEO_EDITOR_CLIP_TOO_LONG") return { code: "CLIP_INVALID", message: "Ein Quellvideo darf höchstens 60 Sekunden lang sein." };
  if (message === "VIDEO_EDITOR_SOURCE_DURATION_TOTAL_TOO_LONG") return { code: "CLIP_INVALID", message: "Deine ausgewählten Videos dürfen zusammen höchstens 180 Sekunden lang sein." };
  if (/LIBRARY/.test(message)) return { code: "LIBRARY_PERSISTENCE_FAILED", message: "Das fertige Video konnte nicht in der Bibliothek gespeichert werden." };
  if (/SOURCE|CLIP|MUSIC|MEDIA/.test(message)) return { code: "CLIP_INVALID", message: "Mindestens ein Medium konnte nicht verarbeitet werden." };
  return { code: "RENDER_FAILED", message: "Das Fashion-Reel konnte nicht fertig gerendert werden." };
}

async function ensureLibraryAsset(input: {
  context: XerianoAccountContext;
  manifest: VideoEditorManifest;
  resultId: string;
  filePath: string;
  byteLength: number;
  sha256: string;
}) {
  const admin = createAdminClient();
  const existing = await admin.from("xeriano_library_assets").select("id")
    .eq("account_id", input.context.accountId).eq("source_studio", "UPLOAD")
    .eq("source_job_id", input.manifest.jobId).eq("source_result_id", input.resultId).maybeSingle();
  if (existing.error) throw new Error("VIDEO_EDITOR_LIBRARY_LOOKUP_FAILED");
  if (existing.data) return existing.data.id as string;
  const storagePath = `accounts/${input.context.accountId}/generated/video_editor/${input.manifest.jobId}/${input.resultId}.mp4`;
  const upload = await admin.storage.from(LIBRARY_BUCKET).upload(storagePath, createReadStream(input.filePath), {
    contentType: "video/mp4", upsert: false, duplex: "half",
  });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw new Error("VIDEO_EDITOR_LIBRARY_UPLOAD_FAILED");
  const inserted = await admin.from("xeriano_library_assets").insert({
    account_id: input.context.accountId,
    owner_user_id: input.context.userId,
    asset_type: "VIDEO",
    title: input.manifest.setup.title,
    description: "Mit dem Xeriamo Video Editor zusammengestellt.",
    source_studio: "UPLOAD",
    source_job_id: input.manifest.jobId,
    source_result_id: input.resultId,
    storage_bucket: LIBRARY_BUCKET,
    storage_path: storagePath,
    mime_type: "video/mp4",
    byte_length: input.byteLength,
    checksum_sha256: input.sha256,
    favorite: false,
    tags: ["video-editor", "fashion-reel"],
    provenance: {
      contractVersion: VIDEO_EDITOR_CONTRACT_VERSION,
      projectId: input.manifest.projectId,
      targetDurationSeconds: input.manifest.setup.targetDurationSeconds,
      aspectRatio: input.manifest.setup.aspectRatio,
      resolution: input.manifest.setup.resolution,
      fps: input.manifest.setup.fps,
      preset: input.manifest.setup.preset,
      tempo: input.manifest.setup.tempo,
      keepOriginalAudio: input.manifest.setup.keepOriginalAudio,
      clipCount: input.manifest.setup.clips.filter((clip) => clip.enabled).length,
    },
  }).select("id").single();
  if (!inserted.error) return inserted.data.id as string;
  const raced = await admin.from("xeriano_library_assets").select("id")
    .eq("account_id", input.context.accountId).eq("source_studio", "UPLOAD")
    .eq("source_job_id", input.manifest.jobId).eq("source_result_id", input.resultId).maybeSingle();
  if (raced.data) return raced.data.id as string;
  await admin.storage.from(LIBRARY_BUCKET).remove([storagePath]);
  throw new Error("VIDEO_EDITOR_LIBRARY_INSERT_FAILED");
}

export async function validateVideoEditorRequestSources(input: { context: XerianoAccountContext; request: VideoEditorRenderRequest }) {
  return preflightVideoEditorSources(input);
}

export async function createDurableVideoEditorJob(input: {
  context: XerianoAccountContext;
  request: VideoEditorRenderRequest;
  store?: SupabaseVideoEditorJobStore;
  leaseStore?: VideoEditorRenderLeaseStore;
}) {
  await validateVideoEditorRequestSources(input);
  const store = input.store ?? new SupabaseVideoEditorJobStore();
  const leaseStore = input.leaseStore ?? new SupabaseVideoEditorRenderLeaseStore();
  const scope = videoEditorScope(input.context);
  const lease = await leaseStore.acquire({ context: input.context, jobId: input.request.jobId });
  try {
    const claimed = await store.claim({ scope, jobId: input.request.jobId, fingerprint: videoEditorFingerprint(input.request) });
    if (claimed === "EXISTS") {
      const existing = await store.readManifest(scope, input.request.jobId);
      if (lease === "ACQUIRED") await leaseStore.release({ context: input.context, jobId: input.request.jobId });
      if (!existing) throw new Error("VIDEO_EDITOR_JOB_INCONSISTENT");
      return { created: false as const, manifest: existing };
    }
    const manifest = createPreparingVideoEditorManifest(input);
    await store.writeManifest(manifest);
    const confirmed = await store.readManifest(scope, manifest.jobId);
    if (!confirmed) throw new Error("VIDEO_EDITOR_JOB_NOT_DURABLE");
    const allSources = [...input.request.clips.map((clip) => clip.source), ...(input.request.music ? [input.request.music.source] : [])];
    try {
      await bindVideoEditorTempSources({ context: input.context, sources: allSources, jobId: manifest.jobId });
    } catch (error) {
      await store.writeManifest(transitionVideoEditorManifest(confirmed, {
        status: "FAILED", completedAt: new Date().toISOString(),
        error: { code: "CLIP_INVALID", message: "Die hochgeladenen Medien konnten nicht sicher an das Projekt gebunden werden." },
      }));
      throw error;
    }
    return { created: true as const, manifest: confirmed };
  } catch (error) {
    await leaseStore.release({ context: input.context, jobId: input.request.jobId }).catch(() => undefined);
    throw error;
  }
}

export async function analyzeOwnedVideoEditorSource(input: {
  context: XerianoAccountContext;
  source: VideoEditorSource;
  deadlineAt?: number;
}) {
  const deadlineAt = input.deadlineAt ?? Date.now() + VIDEO_EDITOR_ANALYSIS_BUDGET_MS;
  const locator = await resolveVideoEditorSourceMetadata({ context: input.context, source: input.source, expected: "VIDEO" });
  await assertVideoEditorProcessingSpace(locator.byteLength);
  const directory = await mkdtemp(path.join(tmpdir(), "xeriamo-editor-analysis-"));
  try {
    const filePath = path.join(directory, `source.${videoEditorExtension(locator.mimeType)}`);
    const streamed = await streamVideoEditorSourceToFile({ locator, destination: filePath, deadlineAt });
    const result = await analyzeVideoEditorClipPath({ filePath, checksum: streamed.checksum, timeoutMs: remaining(deadlineAt) });
    if (result.inspection.durationSeconds > VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS + 0.05) throw new Error("VIDEO_EDITOR_CLIP_TOO_LONG");
    return result;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function processVideoEditorJob(input: {
  context: XerianoAccountContext;
  jobId: string;
  deadlineAt?: number;
  store?: SupabaseVideoEditorJobStore;
  leaseStore?: VideoEditorRenderLeaseStore;
}) {
  const deadlineAt = input.deadlineAt ?? Date.now() + VIDEO_EDITOR_INVOCATION_BUDGET_MS;
  const store = input.store ?? new SupabaseVideoEditorJobStore();
  const leaseStore = input.leaseStore ?? new SupabaseVideoEditorRenderLeaseStore();
  const scope = videoEditorScope(input.context);
  let manifest = await store.readManifest(scope, input.jobId);
  if (!manifest || manifest.status !== "PREPARING") return manifest;
  manifest = transitionVideoEditorManifest(manifest, { status: "RENDERING", renderStartedAt: new Date().toISOString() });
  await store.writeManifest(manifest);
  const directory = await mkdtemp(path.join(tmpdir(), "xeriamo-editor-render-"));
  try {
    const preflight = await preflightVideoEditorSources({ context: input.context, request: {
      ...manifest.setup, contractVersion: VIDEO_EDITOR_CONTRACT_VERSION, jobId: manifest.jobId, projectId: manifest.projectId,
    } });
    await assertVideoEditorProcessingSpace(preflight.totalBytes);
    const local = new Map<string, { filePath: string; inspection: Awaited<ReturnType<typeof inspectVideoEditorMediaPath>> }>();
    const failedClipIds: string[] = [];
    let totalActualDuration = 0;
    for (const [index, locator] of preflight.clips.entries()) {
      try {
        remaining(deadlineAt);
        const filePath = path.join(directory, `clip-${index}.${videoEditorExtension(locator.mimeType)}`);
        await streamVideoEditorSourceToFile({ locator, destination: filePath, deadlineAt });
        const inspection = await inspectVideoEditorMediaPath(filePath, Math.min(20_000, remaining(deadlineAt)));
        if (inspection.durationSeconds > VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS + 0.05) throw new Error("VIDEO_EDITOR_CLIP_TOO_LONG");
        totalActualDuration += inspection.durationSeconds;
        if (totalActualDuration > VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS + 0.05) throw new Error("VIDEO_EDITOR_SOURCE_DURATION_TOTAL_TOO_LONG");
        local.set(sourceKey(locator.source), { filePath, inspection });
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (["VIDEO_EDITOR_CLIP_TOO_LONG", "VIDEO_EDITOR_SOURCE_DURATION_TOTAL_TOO_LONG", "VIDEO_EDITOR_TIMEOUT"].includes(code)) throw error;
        failedClipIds.push(manifest.setup.clips[index]!.id);
      }
    }
    let music: Parameters<typeof renderVideoEditorMp4>[0]["music"] = null;
    if (preflight.music && manifest.setup.music) {
      const filePath = path.join(directory, `music.${videoEditorExtension(preflight.music.mimeType)}`);
      await streamVideoEditorSourceToFile({ locator: preflight.music, destination: filePath, deadlineAt });
      music = { filePath, volume: manifest.setup.music.volume, fade: manifest.setup.music.fade };
    }
    const requestedSegments = buildVideoEditorRenderSegments(manifest.setup.clips, manifest.setup.targetDurationSeconds);
    const clips: Parameters<typeof renderVideoEditorMp4>[0]["clips"] = [];
    for (const segment of requestedSegments) {
      const found = local.get(sourceKey(segment.source));
      if (!found || segment.trimStartSeconds < 0 || segment.trimStartSeconds + segment.renderDurationSeconds > found.inspection.durationSeconds + 0.05) {
        if (!failedClipIds.includes(segment.id)) failedClipIds.push(segment.id);
        continue;
      }
      clips.push({ id: segment.id, filePath: found.filePath, trimStartSeconds: segment.trimStartSeconds, durationSeconds: segment.renderDurationSeconds, inspection: found.inspection });
    }
    if (clips.length < 2) throw new Error("VIDEO_EDITOR_NOT_ENOUGH_VALID_CLIPS");
    const outputPath = path.join(directory, "fashion-reel.mp4");
    const rendered = await renderVideoEditorMp4({
      clips, keepOriginalAudio: manifest.setup.keepOriginalAudio, music, outputPath,
      timeoutMs: remaining(deadlineAt, POST_RENDER_RESERVE_MS),
    });
    remaining(deadlineAt);
    const output = await stat(outputPath);
    if (!output.isFile() || output.size < 1 || output.size > VIDEO_EDITOR_MAX_OUTPUT_BYTES) throw new Error("VIDEO_EDITOR_RESULT_TOO_LARGE");
    const sha256 = await sha256File(outputPath);
    const resultId = randomUUID();
    const stored = await store.persistResultFile({ scope, jobId: manifest.jobId, resultId, filePath: outputPath, sha256 });
    remaining(deadlineAt);
    const libraryAssetId = await ensureLibraryAsset({ context: input.context, manifest, resultId, filePath: outputPath, byteLength: stored.byteLength, sha256 });
    manifest = transitionVideoEditorManifest(manifest, {
      status: "SUCCEEDED", failedClipIds, completedAt: new Date().toISOString(), error: null,
      result: {
        id: resultId, storagePath: stored.storagePath, mimeType: "video/mp4", byteLength: stored.byteLength,
        sha256, durationSeconds: Math.min(30.2, rendered.inspection.durationSeconds), width: 720, height: 1280, fps: 30, libraryAssetId,
      },
    });
    await store.writeManifest(manifest);
    return manifest;
  } catch (error) {
    const latest = await store.readManifest(scope, input.jobId);
    if (!latest || ["SUCCEEDED", "FAILED"].includes(latest.status)) return latest;
    const failed = transitionVideoEditorManifest(latest, { status: "FAILED", completedAt: new Date().toISOString(), error: safeRenderError(error) });
    await store.writeManifest(failed);
    return failed;
  } finally {
    await rm(directory, { recursive: true, force: true });
    await leaseStore.release({ context: input.context, jobId: input.jobId }).catch(() => undefined);
  }
}
