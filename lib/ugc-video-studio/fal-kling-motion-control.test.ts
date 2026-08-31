import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  assertKlingMotionCostAllowed,
  assertKlingMotionReferences,
  estimateKlingMotionMaximumCostUsd,
  KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  KlingMotionReferenceError,
  resolveKlingMotionReferences,
} from "@/lib/ugc-video-studio/kling-motion-config";
import type {
  UgcVideoProviderReference,
  UgcVideoProviderStatus,
} from "@/lib/ugc-video-studio/provider";
import {
  buildKlingMotionInput,
  FalKlingMotionControlProvider,
  type FalKlingMotionControlInput,
  type FalKlingMotionControlTransport,
} from "@/lib/ugc-video-studio/providers/fal-kling-motion-control";
import { UgcVideoCostCapError } from "@/lib/ugc-video-studio/seedance-config";
import { getUgcVideoProviderPublicConfig } from "@/lib/ugc-video-studio/provider-config";

function reference(input: {
  id: string;
  name: string;
  mediaType: "IMAGE" | "VIDEO";
  role: "NONE" | "IDENTITY" | "FACE" | "MODEL" | "MOTION";
  order: number;
  durationSeconds?: number | null;
}) {
  return {
    id: input.id,
    name: input.name,
    mimeType: input.mediaType === "IMAGE" ? "image/png" : "video/mp4",
    mediaType: input.mediaType,
    byteLength: 12,
    durationSeconds: input.durationSeconds ?? null,
    role: input.role,
    order: input.order,
  } as const;
}

function setup(
  overrides: Partial<UgcVideoGenerationSetup> = {},
): UgcVideoGenerationSetup {
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    prompt: "Authentisches iPhone-UGC mit natürlicher Bewegung.",
    modelId: "kling-v3-pro-motion-control",
    duration: "5",
    aspectRatio: "9:16",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      reference({
        id: "character",
        name: "model.png",
        mediaType: "IMAGE",
        role: "MODEL",
        order: 0,
      }),
      reference({
        id: "motion",
        name: "motion.mp4",
        mediaType: "VIDEO",
        role: "MOTION",
        order: 1,
        durationSeconds: 5,
      }),
      reference({
        id: "face",
        name: "face.png",
        mediaType: "IMAGE",
        role: "FACE",
        order: 2,
      }),
    ],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    ...overrides,
  });
}

function providerReferences(
  active: UgcVideoGenerationSetup,
): UgcVideoProviderReference[] {
  return active.references.map((metadata) => ({
    metadata,
    bytes: Buffer.alloc(metadata.byteLength, metadata.order + 1),
  }));
}

function completedStatus(): UgcVideoProviderStatus {
  return {
    status: "COMPLETED",
    queuePosition: null,
    error: null,
    logs: [],
    inferenceTimeSeconds: null,
    metrics: null,
    truncated: false,
  };
}

test("Kling registry contract uses the exact current fal endpoint", async () => {
  const { ugcVideoModelById } = await import(
    "@/lib/ugc-video-studio/model-registry"
  );
  const model = ugcVideoModelById("kling-v3-pro-motion-control");
  assert.equal(model?.availability, "LIVE");
  assert.equal(model?.providerId, "fal");
  assert.equal(model?.providerModelId, KLING_V3_PRO_MOTION_CONTROL_MODEL_ID);
  assert.equal(model?.settingsKind, "KLING_MOTION_CONTROL");
  assert.deepEqual(model?.supportedAspectRatios, []);
  assert.deepEqual(model?.supportedQualities, []);
  assert.deepEqual(model?.supportedBitrates, []);
});

test("role-based mapping resolves character, motion, and one dedicated face", () => {
  const active = setup();
  const resolved = assertKlingMotionReferences(active);
  assert.equal(resolved.characterImage?.id, "character");
  assert.equal(resolved.motionVideo?.id, "motion");
  assert.equal(resolved.identityElement?.id, "face");
});

test("exactly one image and video auto-map without forced roles", () => {
  const active = setup({
    references: [
      reference({ id: "image", name: "a.png", mediaType: "IMAGE", role: "NONE", order: 0 }),
      reference({ id: "video", name: "b.mp4", mediaType: "VIDEO", role: "NONE", order: 1, durationSeconds: 5 }),
    ],
  });
  const resolved = assertKlingMotionReferences(active);
  assert.equal(resolved.characterImage?.id, "image");
  assert.equal(resolved.motionVideo?.id, "video");
  assert.equal(resolved.identityElement, null);
});

test("ambiguous image or motion references require an explicit owner choice", () => {
  const active = setup({
    references: [
      reference({ id: "a", name: "a.png", mediaType: "IMAGE", role: "MODEL", order: 0 }),
      reference({ id: "b", name: "b.png", mediaType: "IMAGE", role: "IDENTITY", order: 1 }),
      reference({ id: "v1", name: "a.mp4", mediaType: "VIDEO", role: "MOTION", order: 2 }),
      reference({ id: "v2", name: "b.mp4", mediaType: "VIDEO", role: "MOTION", order: 3 }),
    ],
    klingMotion: {
      ...DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
      faceBindingEnabled: false,
    },
  });
  const resolved = resolveKlingMotionReferences(active);
  assert.equal(resolved.characterImageAmbiguous, true);
  assert.equal(resolved.motionVideoAmbiguous, true);
  assert.throws(() => assertKlingMotionReferences(active), (error) => {
    assert.ok(error instanceof KlingMotionReferenceError);
    assert.equal(error.reason, "CHARACTER_IMAGE_AMBIGUOUS");
    return true;
  });
});

test("image and video orientation map exactly and do not invent ratio/resolution/bitrate", () => {
  const image = setup({
    klingMotion: {
      ...DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
      characterOrientation: "IMAGE",
      faceBindingEnabled: false,
      keepOriginalSound: true,
    },
  });
  const input = buildKlingMotionInput({
    setup: image,
    providerPrompt: image.prompt,
    characterImageUrl: "https://fal.media/character.png",
    motionVideoUrl: "https://fal.media/motion.mp4",
    identityElementUrl: null,
  });
  assert.equal(input.character_orientation, "image");
  assert.equal(input.keep_original_sound, true);
  assert.equal("duration" in input, false);
  assert.equal("aspect_ratio" in input, false);
  assert.equal("resolution" in input, false);
  assert.equal("bitrate_mode" in input, false);
});

test("face binding is one @Element1 image and only applies to video orientation", () => {
  const active = setup();
  const input = buildKlingMotionInput({
    setup: active,
    providerPrompt: `${active.prompt}\n@Element1`,
    characterImageUrl: "https://fal.media/character.png",
    motionVideoUrl: "https://fal.media/motion.mp4",
    identityElementUrl: "https://fal.media/face.png",
  });
  assert.equal(input.character_orientation, "video");
  assert.deepEqual(input.elements, [
    { frontal_image_url: "https://fal.media/face.png" },
  ]);
  assert.equal(input.elements?.length, 1);

  const imageOrientation = setup({
    klingMotion: {
      ...active.klingMotion,
      characterOrientation: "IMAGE",
      faceBindingEnabled: false,
    },
  });
  const withoutElement = buildKlingMotionInput({
    setup: imageOrientation,
    providerPrompt: imageOrientation.prompt,
    characterImageUrl: "https://fal.media/character.png",
    motionVideoUrl: "https://fal.media/motion.mp4",
    identityElementUrl: "https://fal.media/face.png",
  });
  assert.equal(withoutElement.elements, undefined);
});

test("orientation-specific motion duration limits stay fail-closed", () => {
  const image = setup({
    duration: "15",
    references: setup().references.map((item) =>
      item.id === "motion" ? { ...item, durationSeconds: 26 } : item,
    ),
    klingMotion: {
      ...DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
      characterOrientation: "IMAGE",
      faceBindingEnabled: false,
    },
  });
  assert.throws(() => assertKlingMotionReferences(image), (error) => {
    assert.ok(error instanceof KlingMotionReferenceError);
    assert.equal(error.reason, "DURATION_EXCEEDS_ORIENTATION");
    return true;
  });

  const video = setup({
    duration: "30",
    references: setup().references.map((item) =>
      item.id === "motion" ? { ...item, durationSeconds: 30 } : item,
    ),
  });
  assert.equal(assertKlingMotionReferences(video).motionVideo?.durationSeconds, 30);

  const shortSource = setup({
    duration: "10",
    references: setup().references.map((item) =>
      item.id === "motion" ? { ...item, durationSeconds: 8 } : item,
    ),
  });
  assert.throws(() => assertKlingMotionReferences(shortSource), (error) => {
    assert.ok(error instanceof KlingMotionReferenceError);
    assert.equal(error.reason, "DURATION_EXCEEDS_SOURCE");
    return true;
  });
});

test("per-second pricing estimate and dedicated cost cap are enforced", () => {
  assert.equal(
    estimateKlingMotionMaximumCostUsd({
      characterOrientation: "VIDEO",
      selectedDurationSeconds: 5,
    }),
    0.84,
  );
  assert.equal(
    assertKlingMotionCostAllowed({
      setup: setup(),
      configuredCostCapUsd: 0.84,
    }),
    0.84,
  );
  assert.throws(
    () =>
      assertKlingMotionCostAllowed({
        setup: setup(),
        configuredCostCapUsd: null,
      }),
    UgcVideoCostCapError,
  );
});

test("Kling public readiness uses its dedicated manual cost cap", () => {
  const missing = getUgcVideoProviderPublicConfig({
    NODE_ENV: "test",
    FAL_KEY: "test-only",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
  });
  assert.equal(
    missing.models["kling-v3-pro-motion-control"].costCapConfigured,
    false,
  );
  assert.equal(missing.models["kling-v3-pro-motion-control"].ready, false);
  assert.equal(missing.models["kling-v3-pro-motion-control"].ownerReady, true);
  const ready = getUgcVideoProviderPublicConfig({
    NODE_ENV: "test",
    FAL_KEY: "test-only",
    NEXHQ_UGC_KLING_MOTION_COST_MAX_USD: "6",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
  });
  assert.equal(ready.models["kling-v3-pro-motion-control"].ready, true);
  assert.equal(
    ready.models["kling-v3-pro-motion-control"].costCapEnvironmentName,
    "NEXHQ_UGC_KLING_MOTION_COST_MAX_USD",
  );
});

test("trusted provider URLs bypass redundant fal storage upload", async () => {
  const active = setup();
  let uploadCalls = 0;
  const captured: { value: FalKlingMotionControlInput | null } = { value: null };
  const transport: FalKlingMotionControlTransport = {
    async uploadReference() {
      uploadCalls += 1;
      return "https://fal.invalid/uploaded";
    },
    async submit(_endpoint, input) {
      captured.value = input;
      return {
        requestId: "signed-reference-request",
        statusUrl: null,
        responseUrl: null,
        cancelUrl: null,
        queuePosition: null,
      };
    },
    async status() { return completedStatus(); },
    async result() {
      return {
        requestId: "signed-reference-request",
        data: { video: { url: "https://fal.media/result.mp4" } },
      };
    },
  };
  const references = providerReferences(active).map((item) => ({
    ...item,
    providerUrl: `https://private.example/${item.metadata.id}?signed=server-only`,
  }));
  await new FalKlingMotionControlProvider(undefined, transport).submit({
    clientRequestId: "99999999-9999-4999-8999-999999999999",
    endUserId: "owner",
    setup: active,
    references,
  });
  assert.equal(uploadCalls, 0);
  assert.equal(captured.value?.image_url, "https://private.example/character?signed=server-only");
  assert.equal(captured.value?.video_url, "https://private.example/motion?signed=server-only");
});

test("Kling adapter uploads selected references in stable order and submits once", async () => {
  const active = setup();
  const uploaded: string[] = [];
  const captured: { value: FalKlingMotionControlInput | null } = { value: null };
  let submitCalls = 0;
  const transport: FalKlingMotionControlTransport = {
    async uploadReference(item) {
      uploaded.push(item.metadata.id);
      return `https://fal.media/${item.metadata.id}`;
    },
    async submit(endpoint, input) {
      assert.equal(endpoint, KLING_V3_PRO_MOTION_CONTROL_MODEL_ID);
      submitCalls += 1;
      captured.value = input;
      return {
        requestId: "kling-request-1",
        statusUrl: "https://fal/status",
        responseUrl: "https://fal/result",
        cancelUrl: "https://fal/cancel",
        queuePosition: 2,
      };
    },
    async status() {
      return completedStatus();
    },
    async result() {
      return {
        requestId: "kling-request-1",
        data: {
          video: {
            url: "https://fal.media/result.mp4",
            content_type: "video/mp4",
          },
        },
      };
    },
  };
  const provider = new FalKlingMotionControlProvider(undefined, transport);
  const submission = await provider.submit({
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    endUserId: "owner",
    setup: active,
    references: providerReferences(active).reverse(),
  });
  assert.deepEqual(uploaded, ["character", "motion", "face"]);
  assert.equal(submitCalls, 1);
  assert.equal(submission.providerRequestId, "kling-request-1");
  assert.deepEqual(submission.referenceOrder, ["character", "motion", "face"]);
  assert.equal(captured.value?.image_url, "https://fal.media/character");
  assert.equal(captured.value?.video_url, "https://fal.media/motion");
  assert.deepEqual(captured.value?.elements, [
    { frontal_image_url: "https://fal.media/face" },
  ]);
  assert.match(captured.value?.prompt ?? "", /@Element1/);
  assert.equal(
    (await provider.getStatus(submission.providerRequestId)).status,
    "COMPLETED",
  );
  const result = await provider.getResult({
    providerRequestId: submission.providerRequestId,
    setup: active,
    providerPrompt: submission.providerPrompt,
    referenceOrder: submission.referenceOrder,
  });
  assert.equal(result.result.providerModel, KLING_V3_PRO_MOTION_CONTROL_MODEL_ID);
  assert.equal(result.result.url, "https://fal.media/result.mp4");
  assert.equal(submitCalls, 1);
});
