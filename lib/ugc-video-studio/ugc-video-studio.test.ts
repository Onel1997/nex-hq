import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type SavedUgcVideoPrompt,
  type UgcVideoRun,
} from "@/lib/ugc-video-studio/contracts";
import {
  UGC_VIDEO_MODEL_REGISTRY,
  ugcVideoModelById,
} from "@/lib/ugc-video-studio/model-registry";
import {
  UGC_VIDEO_STORAGE_KEY,
  loadUgcVideoState,
  saveUgcVideoState,
  selectUgcVideoRunForMode,
  upsertUgcVideoPrompt,
  upsertUgcVideoRun,
  type UgcVideoStorage,
} from "@/lib/ugc-video-studio/persistence";
import {
  getUgcVideoProviderPublicConfig,
  SEEDANCE_25_REFERENCE_MODEL_ID,
} from "@/lib/ugc-video-studio/seedance-config";

function setup() {
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    prompt: "Realistisches iPhone-UGC-Video mit natürlicher Handheld-Bewegung.",
    modelId: "seedance-2.5",
    duration: "5",
    aspectRatio: "9:16",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      {
        id: "ref-image",
        name: "model.png",
        mimeType: "image/png",
        mediaType: "IMAGE",
        byteLength: 12,
        durationSeconds: null,
        role: "MODEL",
        order: 0,
      },
      {
        id: "ref-video",
        name: "motion.mp4",
        mimeType: "video/mp4",
        mediaType: "VIDEO",
        byteLength: 16,
        durationSeconds: 4,
        role: "MOTION",
        order: 1,
      },
    ],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  });
}

function memoryStorage(): UgcVideoStorage & { value: string | null } {
  return {
    value: null,
    getItem(key) {
      return key === UGC_VIDEO_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === UGC_VIDEO_STORAGE_KEY) this.value = value;
    },
  };
}

test("UGC contract supports flexible ordered image/video/audio references", () => {
  const parsed = setup();
  assert.deepEqual(
    parsed.references.map((reference) => reference.mediaType),
    ["IMAGE", "VIDEO"],
  );
  assert.deepEqual(parsed.references.map((reference) => reference.order), [0, 1]);
  assert.equal(parsed.prompt.startsWith("Realistisches"), true);
});

test("video model registry exposes Motion Control and all benchmark Video Edit models as live", () => {
  const live = UGC_VIDEO_MODEL_REGISTRY.filter(
    (model) =>
      model.availability === "LIVE" &&
      !model.modeCompatibility.includes("BASE_VIDEO"),
  );
  assert.deepEqual(live.map((model) => model.id), [
    "seedance-2.5",
    "kling-v3-pro-motion-control",
    "kling-o3-pro-video-edit",
    "kling-o1-standard-video-edit",
    "seedance-2-fast-video-edit",
    "kling-o3-pro-video-recast",
  ]);
  assert.equal(
    ugcVideoModelById("seedance-2.5")?.providerModelId,
    SEEDANCE_25_REFERENCE_MODEL_ID,
  );
  assert.deepEqual(
    ugcVideoModelById("seedance-2.5")?.supportedReferenceTypes,
    ["IMAGE", "VIDEO", "AUDIO"],
  );
  assert.deepEqual(
    ugcVideoModelById("seedance-2.5")?.supportedBitrates,
    ["STANDARD", "HIGH"],
  );
});

test("public provider configuration reports the real 50 MiB V1 persistence limit", () => {
  const config = getUgcVideoProviderPublicConfig({
    NODE_ENV: "test",
    FAL_KEY: "test-only",
    NEXHQ_UGC_SEEDANCE_COST_MAX_USD: "10",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
  });
  assert.equal(config.resultStorageLimitBytes, 52_428_800);
});

test("prompt library and run history persist setup metadata without media bytes", () => {
  const storage = memoryStorage();
  const timestamp = "2026-08-27T18:00:00.000Z";
  const active = setup();
  const prompt: SavedUgcVideoPrompt = {
    id: "prompt-1",
    title: "iPhone Fit Check",
    description: "Natürliches UGC",
    tags: ["UGC", "Fit Check"],
    favorite: true,
    mode: active.mode,
    prompt: active.prompt,
    modelId: active.modelId,
    duration: active.duration,
    aspectRatio: active.aspectRatio,
    quality: active.quality,
    bitrate: active.bitrate,
    videoType: active.videoType,
    advanced: active.advanced,
    klingMotion: active.klingMotion,
    videoEdit: active.videoEdit,
    videoRecast: active.videoRecast,
    baseVideo: active.baseVideo,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUsedAt: null,
  };
  const run: UgcVideoRun = {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "SUCCEEDED",
    setup: active,
    results: [],
    message: "Erfolgreich",
  };
  let state = upsertUgcVideoPrompt(loadUgcVideoState(storage), prompt);
  state = upsertUgcVideoRun(state, run);
  saveUgcVideoState(storage, state);
  const raw = storage.value ?? "";
  assert.equal(raw.includes("data:video"), false);
  assert.equal(raw.includes("base64"), false);
  const restored = loadUgcVideoState(storage);
  assert.equal(restored.prompts[0]?.duration, "5");
  assert.equal(restored.prompts[0]?.quality, "720p");
  assert.equal(restored.prompts[0]?.bitrate, "STANDARD");
  assert.equal(restored.runs[0]?.setup.references[1]?.role, "MOTION");
});

test("result selection is isolated by workspace mode without mutating history or running jobs", () => {
  const editRun: UgcVideoRun = {
    id: "11111111-1111-4111-8111-111111111112",
    createdAt: "2026-09-03T18:00:00.000Z",
    updatedAt: "2026-09-03T18:01:00.000Z",
    status: "UNKNOWN_OUTCOME",
    setup: ugcVideoGenerationSetupSchema.parse({
      ...setup(),
      mode: "VIDEO_EDIT",
      modelId: "kling-o3-pro-video-edit",
    }),
    results: [],
    message: "Der Anbieterstatus konnte nicht sicher abgerufen werden.",
  };
  const recastRun: UgcVideoRun = {
    ...editRun,
    id: "11111111-1111-4111-8111-111111111113",
    status: "SUCCEEDED",
    setup: ugcVideoGenerationSetupSchema.parse({
      ...setup(),
      mode: "VIDEO_RECAST",
      modelId: "kling-o3-pro-video-recast",
      videoRecast: {
        profile: "KLING_O3_CHARACTER_SCENE_RECAST",
        sourceVideoReferenceId: "ref-video",
        characterOutfitReferenceId: "ref-image",
        faceReferenceId: null,
        sceneStyleReferenceId: null,
        sourceDurationSeconds: 4,
        keepAudio: false,
      },
    }),
    results: [
      {
        id: "recast-result",
        url: "/api/ugc-video-studio/assets/recast/result",
        downloadUrl: "/api/ugc-video-studio/assets/recast/result?download=1",
        mimeType: "video/mp4",
        width: 720,
        height: 1280,
        durationSeconds: 4,
        byteLength: 1_024,
        favorite: false,
        provider: "fal",
        providerModel: "fal-ai/kling-video/o3/pro/video-to-video/edit",
        providerRequestId: "provider-request",
      },
    ],
    message: "Video wurde erstellt.",
  };
  const runningRun: UgcVideoRun = {
    ...editRun,
    id: "11111111-1111-4111-8111-111111111114",
    status: "RUNNING",
    message: "Video wird erstellt …",
  };
  const state = upsertUgcVideoRun(
    upsertUgcVideoRun(
      upsertUgcVideoRun(
        { version: 1, prompts: [], runs: [] },
        editRun,
      ),
      recastRun,
    ),
    runningRun,
  );

  assert.equal(selectUgcVideoRunForMode(editRun, "VIDEO_RECAST"), null);
  assert.equal(selectUgcVideoRunForMode(recastRun, "VIDEO_EDIT"), null);
  assert.equal(selectUgcVideoRunForMode(editRun, "VIDEO_EDIT"), editRun);
  assert.equal(selectUgcVideoRunForMode(recastRun, "VIDEO_RECAST"), recastRun);
  assert.deepEqual(state.runs.map((run) => run.id), [
    runningRun.id,
    recastRun.id,
    editRun.id,
  ]);
  assert.equal(state.runs[0]?.status, "RUNNING");
  assert.equal(state.runs[1]?.results[0]?.id, "recast-result");
});

test("route, German owner UI, compact controls and Generate-only sticky action are present", () => {
  const page = readFileSync(
    "app/(dashboard)/ugc-video-studio/page.tsx",
    "utf8",
  );
  const workspace = readFileSync(
    "components/ugc-video-studio/ugc-video-studio-workspace.tsx",
    "utf8",
  );
  const controls = readFileSync(
    "components/ugc-video-studio/ugc-video-studio-controls.tsx",
    "utf8",
  );
  const css = readFileSync("app/ugc-video-studio.css", "utf8");
  assert.match(page, /UGC Video Studio/);
  assert.match(workspace, /Referenzen/);
  assert.match(workspace, /Prompt speichern/);
  assert.match(workspace, /Ergebnisse/);
  assert.match(workspace, /Verlauf/);
  assert.match(workspace, /V1-Speicherlimit/);
  assert.match(workspace, /Die Videoerstellung wurde nicht gestartet/);
  assert.match(workspace, /Es sind keine Providerkosten entstanden/);
  assert.match(workspace, /UGC_VIDEO_STORAGE_SETUP_FAILED/);
  assert.match(workspace, /UgcKlingMotionControls/);
  assert.match(workspace, /kling-v3-pro-motion-control/);
  assert.match(controls, /Gesicht stärker beibehalten/);
  assert.match(controls, /Originalton übernehmen/);
  assert.match(controls, /Videolänge/);
  assert.match(controls, /Die Credits richten sich nach der gewählten Videolänge/);
  assert.match(controls, /KLING_MOTION_DURATION_CHOICES/);
  assert.match(workspace, /className="uv-generate-bar"/);
  assert.match(workspace, /Generieren/);
  const stickyMarkup = workspace.match(
    /<div className="uv-generate-bar">[\s\S]*?<\/div>/,
  )?.[0];
  assert.ok(stickyMarkup);
  assert.doesNotMatch(stickyMarkup, /Seitenverhältnis|Qualität|Bitrate|Dauer/);
  assert.match(controls, /role="listbox"/);
  assert.match(controls, /aria-expanded/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.uv-kling-duration button \{[^}]*min-height: 44px/);
  assert.match(css, /\.uv-kling-duration > div \{[^}]*flex-wrap: wrap/);
  assert.match(css, /@media \(max-width:\s*900px\)/);
});

test("UGC Studio stays isolated from Image Studio and the existing Video runtime", () => {
  const files = [
    "components/ugc-video-studio/ugc-video-studio-workspace.tsx",
    "lib/ugc-video-studio/generation-service.ts",
    "lib/ugc-video-studio/providers/fal-seedance.ts",
    "lib/ugc-video-studio/providers/fal-kling-motion-control.ts",
    "app/api/ugc-video-studio/generate/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /@\/lib\/image\//);
    assert.doesNotMatch(source, /@\/lib\/video\//);
    assert.doesNotMatch(source, /agents\/image/);
    assert.doesNotMatch(source, /agents\/video/);
  }
});

test("central navigation contains the separate UGC route", () => {
  const navigation = readFileSync("lib/i18n/data/hq-navigation.ts", "utf8");
  assert.match(navigation, /href: "\/hq\/ugc-video-studio"/);
  assert.match(navigation, /ugcVideo: "UGC Video Studio"/);
});
