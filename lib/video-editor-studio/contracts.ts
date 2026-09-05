import { z } from "zod";

export const VIDEO_EDITOR_CONTRACT_VERSION = "xeriamo-video-editor-v1" as const;
export const VIDEO_EDITOR_MAX_CLIPS = 12;
export const VIDEO_EDITOR_MIN_CLIPS = 2;
export const VIDEO_EDITOR_OUTPUT_MIME_TYPE = "video/mp4" as const;
export const VIDEO_EDITOR_MAX_CLIP_BYTES = 100 * 1024 * 1024;
export const VIDEO_EDITOR_MAX_MUSIC_BYTES = 15 * 1024 * 1024;
export const VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES = 240 * 1024 * 1024;
export const VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS = 60;
export const VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS = 180;
export const VIDEO_EDITOR_MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
export const VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES = 2;
export const VIDEO_EDITOR_INVOCATION_BUDGET_MS = 270_000;
export const VIDEO_EDITOR_ANALYSIS_BUDGET_MS = 105_000;
export const VIDEO_EDITOR_STALE_JOB_MS = 330_000;
export const VIDEO_EDITOR_RENDER_LEASE_MS = 360_000;

export const videoEditorSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEMP_REFERENCE"),
    id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("LIBRARY_ASSET"),
    id: z.string().uuid(),
  }),
]);
export type VideoEditorSource = z.infer<typeof videoEditorSourceSchema>;

export const videoEditorClipSchema = z.object({
  id: z.string().uuid(),
  source: videoEditorSourceSchema,
  title: z.string().trim().min(1).max(160),
  order: z.number().int().min(0).max(VIDEO_EDITOR_MAX_CLIPS - 1),
  enabled: z.boolean(),
  trimStartSeconds: z.number().finite().min(0).max(600),
  trimEndSeconds: z.number().finite().positive().max(600),
  sourceDurationSeconds: z.number().finite().positive().max(VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS),
});
export type VideoEditorClip = z.infer<typeof videoEditorClipSchema>;

export const videoEditorTempoSchema = z.enum(["CALM", "DYNAMIC", "FAST"]);
export type VideoEditorTempo = z.infer<typeof videoEditorTempoSchema>;

const videoEditorRenderRequestObjectSchema = z.object({
  contractVersion: z.literal(VIDEO_EDITOR_CONTRACT_VERSION),
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  clips: z.array(videoEditorClipSchema).min(VIDEO_EDITOR_MIN_CLIPS).max(VIDEO_EDITOR_MAX_CLIPS),
  targetDurationSeconds: z.union([
    z.literal(15),
    z.literal(20),
    z.literal(25),
    z.literal(30),
  ]),
  aspectRatio: z.literal("9:16"),
  resolution: z.literal("720x1280"),
  fps: z.literal(30),
  tempo: videoEditorTempoSchema,
  preset: z.literal("STREETWEAR_PRODUCT_REEL"),
  keepOriginalAudio: z.boolean(),
  music: z
    .object({
      source: videoEditorSourceSchema,
      title: z.string().trim().min(1).max(160),
      volume: z.number().finite().min(0).max(1),
      fade: z.boolean(),
    })
    .nullable(),
}).strict();

export const videoEditorRenderRequestSchema = videoEditorRenderRequestObjectSchema.superRefine((input, context) => {
  if (input.clips.filter((clip) => clip.enabled).length < VIDEO_EDITOR_MIN_CLIPS) {
    context.addIssue({ code: "custom", message: "Mindestens zwei Clips müssen aktiv sein.", path: ["clips"] });
  }
  const orders = input.clips.map((clip) => clip.order);
  if (new Set(orders).size !== orders.length) {
    context.addIssue({ code: "custom", message: "Die Clip-Reihenfolge ist nicht eindeutig.", path: ["clips"] });
  }
  for (const [index, clip] of input.clips.entries()) {
    if (
      clip.trimEndSeconds <= clip.trimStartSeconds ||
      clip.trimEndSeconds > clip.sourceDurationSeconds + 0.05
    ) {
      context.addIssue({ code: "custom", message: "Die Schnittgrenzen sind ungültig.", path: ["clips", index] });
    }
  }
});
export type VideoEditorRenderRequest = z.infer<typeof videoEditorRenderRequestSchema>;

export const videoEditorSetupSchema = videoEditorRenderRequestObjectSchema.omit({
  jobId: true,
  projectId: true,
  contractVersion: true,
});

export const videoEditorJobStatusSchema = z.enum([
  "PREPARING",
  "RENDERING",
  "SUCCEEDED",
  "FAILED",
]);
export type VideoEditorJobStatus = z.infer<typeof videoEditorJobStatusSchema>;

export const videoEditorManifestSchema = z.object({
  version: z.literal(VIDEO_EDITOR_CONTRACT_VERSION),
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  workspaceId: z.string().min(1).max(160),
  actorId: z.string().uuid(),
  status: videoEditorJobStatusSchema,
  setup: videoEditorSetupSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  renderStartedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedClipIds: z.array(z.string().uuid()).max(VIDEO_EDITOR_MAX_CLIPS),
  result: z.object({
    id: z.string().uuid(),
    storagePath: z.string().min(1).max(1000),
    mimeType: z.literal(VIDEO_EDITOR_OUTPUT_MIME_TYPE),
    byteLength: z.number().int().positive().max(VIDEO_EDITOR_MAX_OUTPUT_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    durationSeconds: z.number().finite().positive().max(30.2),
    width: z.literal(720),
    height: z.literal(1280),
    fps: z.literal(30),
    libraryAssetId: z.string().uuid(),
  }).nullable(),
  error: z.object({
    code: z.enum([
      "CLIP_INVALID",
      "NOT_ENOUGH_CLIPS",
      "PROCESSING_SPACE_LOW",
      "RENDER_FAILED",
      "LIBRARY_PERSISTENCE_FAILED",
      "TIMED_OUT",
    ]),
    message: z.string().min(1).max(400),
  }).nullable(),
});
export type VideoEditorManifest = z.infer<typeof videoEditorManifestSchema>;

export type VideoEditorPublicJob = {
  id: string;
  projectId: string;
  status: VideoEditorJobStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  failedClipIds: string[];
  error: VideoEditorManifest["error"];
  result: null | {
    id: string;
    durationSeconds: number;
    width: 720;
    height: 1280;
    fps: 30;
    mimeType: "video/mp4";
    libraryAssetId: string;
    playbackUrl: string;
    downloadUrl: string;
  };
};

export function publicVideoEditorJob(manifest: VideoEditorManifest): VideoEditorPublicJob {
  return {
    id: manifest.jobId,
    projectId: manifest.projectId,
    status: manifest.status,
    title: manifest.setup.title,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    failedClipIds: [...manifest.failedClipIds],
    error: manifest.error,
    result: manifest.result
      ? {
          id: manifest.result.id,
          durationSeconds: manifest.result.durationSeconds,
          width: manifest.result.width,
          height: manifest.result.height,
          fps: manifest.result.fps,
          mimeType: manifest.result.mimeType,
          libraryAssetId: manifest.result.libraryAssetId,
          playbackUrl: `/api/video-editor-studio/jobs/${manifest.jobId}/asset`,
          downloadUrl: `/api/video-editor-studio/jobs/${manifest.jobId}/asset?download=1`,
        }
      : null,
  };
}
