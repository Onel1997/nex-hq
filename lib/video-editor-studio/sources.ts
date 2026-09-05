import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import {
  VIDEO_EDITOR_MAX_CLIP_BYTES,
  VIDEO_EDITOR_MAX_MUSIC_BYTES,
  VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES,
  type VideoEditorRenderRequest,
  type VideoEditorSource,
} from "./contracts";

export type VideoEditorSourceKind = "VIDEO" | "AUDIO";

export type VideoEditorSourceLocator = {
  source: VideoEditorSource;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  title: string;
  byteLength: number;
  checksum: string | null;
};

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);
const AUDIO_MIME_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/x-wav"]);

function assertMime(mimeType: string, expected: VideoEditorSourceKind) {
  const accepted = expected === "VIDEO" ? VIDEO_MIME_TYPES : AUDIO_MIME_TYPES;
  if (!accepted.has(mimeType)) {
    throw new Error(expected === "VIDEO" ? "VIDEO_EDITOR_CLIP_UNSUPPORTED" : "VIDEO_EDITOR_MUSIC_UNSUPPORTED");
  }
}

function assertTrustedByteLength(byteLength: number, expected: VideoEditorSourceKind) {
  const maximum = expected === "VIDEO" ? VIDEO_EDITOR_MAX_CLIP_BYTES : VIDEO_EDITOR_MAX_MUSIC_BYTES;
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > maximum) {
    throw new Error(expected === "VIDEO" ? "VIDEO_EDITOR_CLIP_TOO_LARGE" : "VIDEO_EDITOR_MUSIC_TOO_LARGE");
  }
}

export async function resolveVideoEditorSourceMetadata(input: {
  context: XerianoAccountContext;
  source: VideoEditorSource;
  expected: VideoEditorSourceKind;
}): Promise<VideoEditorSourceLocator> {
  const admin = createAdminClient();
  if (input.source.kind === "LIBRARY_ASSET") {
    const found = await admin.from("xeriano_library_assets")
      .select("title,storage_bucket,storage_path,mime_type,byte_length,checksum_sha256,asset_type")
      .eq("id", input.source.id)
      .eq("account_id", input.context.accountId)
      .maybeSingle();
    if (found.error || !found.data) throw new Error("VIDEO_EDITOR_SOURCE_FORBIDDEN");
    if (found.data.asset_type !== input.expected) throw new Error("VIDEO_EDITOR_SOURCE_INVALID");
    const mimeType = String(found.data.mime_type).toLowerCase();
    const byteLength = Number(found.data.byte_length);
    assertMime(mimeType, input.expected);
    assertTrustedByteLength(byteLength, input.expected);
    return {
      source: input.source,
      storageBucket: String(found.data.storage_bucket),
      storagePath: String(found.data.storage_path),
      mimeType,
      title: String(found.data.title),
      byteLength,
      checksum: found.data.checksum_sha256 ? String(found.data.checksum_sha256) : null,
    };
  }

  const found = await admin.from("xeriano_temp_references")
    .select("original_filename,studio,kind,mime_type,verified_byte_size,storage_bucket,storage_path,checksum_sha256,upload_state,expires_at,bound_job_id")
    .eq("id", input.source.id)
    .eq("account_id", input.context.accountId)
    .eq("actor_user_id", input.context.userId)
    .maybeSingle();
  if (found.error || !found.data) throw new Error("VIDEO_EDITOR_SOURCE_FORBIDDEN");
  const row = found.data as {
    original_filename: string;
    studio: string;
    kind: string;
    mime_type: string;
    verified_byte_size: number | null;
    storage_bucket: string;
    storage_path: string;
    checksum_sha256: string | null;
    upload_state: string;
    expires_at: string;
  };
  if (
    row.studio !== "VIDEO_EDITOR_STUDIO" ||
    row.kind !== input.expected ||
    !["READY", "BOUND"].includes(row.upload_state) ||
    Date.parse(row.expires_at) <= Date.now()
  ) {
    throw new Error(row.studio === "UGC_VIDEO_STUDIO" ? "VIDEO_EDITOR_WRONG_STUDIO" : "VIDEO_EDITOR_SOURCE_INVALID");
  }
  const mimeType = row.mime_type.toLowerCase();
  const byteLength = Number(row.verified_byte_size);
  assertMime(mimeType, input.expected);
  assertTrustedByteLength(byteLength, input.expected);
  return {
    source: input.source,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType,
    title: row.original_filename,
    byteLength,
    checksum: row.checksum_sha256,
  };
}

export async function assertVideoEditorSourceAuthority(input: {
  context: XerianoAccountContext;
  source: VideoEditorSource;
  expected: VideoEditorSourceKind;
}) {
  await resolveVideoEditorSourceMetadata(input);
}

export async function preflightVideoEditorSources(input: {
  context: XerianoAccountContext;
  request: VideoEditorRenderRequest;
}) {
  const seen = new Set<string>();
  const clips: VideoEditorSourceLocator[] = [];
  for (const clip of input.request.clips) {
    const key = `${clip.source.kind}:${clip.source.id}`;
    if (seen.has(key)) throw new Error("VIDEO_EDITOR_DUPLICATE_SOURCE");
    seen.add(key);
    clips.push(await resolveVideoEditorSourceMetadata({ context: input.context, source: clip.source, expected: "VIDEO" }));
  }
  const music = input.request.music
    ? await resolveVideoEditorSourceMetadata({ context: input.context, source: input.request.music.source, expected: "AUDIO" })
    : null;
  const totalBytes = clips.reduce((sum, source) => sum + source.byteLength, 0) + (music?.byteLength ?? 0);
  if (totalBytes > VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES) throw new Error("VIDEO_EDITOR_INPUT_TOTAL_TOO_LARGE");
  return { clips, music, totalBytes };
}

export async function createVideoEditorSourceSignedUrl(locator: VideoEditorSourceLocator, options?: { download?: string }) {
  const signed = await createAdminClient().storage.from(locator.storageBucket).createSignedUrl(
    locator.storagePath,
    60,
    options?.download ? { download: options.download } : undefined,
  );
  if (signed.error || !signed.data?.signedUrl) throw new Error("VIDEO_EDITOR_SOURCE_READ_FAILED");
  return signed.data.signedUrl;
}

export async function bindVideoEditorTempSources(input: {
  context: XerianoAccountContext;
  sources: VideoEditorSource[];
  jobId: string;
}) {
  const ids = [...new Set(input.sources.filter((source) => source.kind === "TEMP_REFERENCE").map((source) => source.id))];
  if (!ids.length) return;
  const admin = createAdminClient();
  const ready = await admin.from("xeriano_temp_references")
    .select("id")
    .eq("account_id", input.context.accountId)
    .eq("actor_user_id", input.context.userId)
    .eq("studio", "VIDEO_EDITOR_STUDIO")
    .eq("upload_state", "READY")
    .in("id", ids);
  if (ready.error) throw new Error("VIDEO_EDITOR_SOURCE_BIND_FAILED");
  const readyIds = (ready.data ?? []).map((row) => row.id as string);
  if (!readyIds.length) return;
  const updated = await admin.from("xeriano_temp_references")
    .update({ upload_state: "BOUND", bound_job_id: input.jobId })
    .eq("account_id", input.context.accountId)
    .eq("actor_user_id", input.context.userId)
    .eq("studio", "VIDEO_EDITOR_STUDIO")
    .eq("upload_state", "READY")
    .in("id", readyIds)
    .select("id");
  if (updated.error || updated.data?.length !== readyIds.length) throw new Error("VIDEO_EDITOR_SOURCE_BIND_FAILED");
}
