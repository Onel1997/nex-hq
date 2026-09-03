import type {
  UgcVideoGenerationSetup,
  UgcVideoRecastSettings,
  UgcVideoReferenceMetadata,
} from "@/lib/ugc-video-studio/contracts";

export const KLING_O3_PRO_VIDEO_RECAST_MODEL_ID =
  "kling-o3-pro-video-recast" as const;
export const KLING_O3_PRO_VIDEO_RECAST_ENDPOINT =
  "fal-ai/kling-video/o3/pro/video-to-video/edit" as const;
export const VIDEO_RECAST_PRICING_VERSION =
  "xeriamo-video-recast-provider-cost-v1" as const;
export const KLING_O3_PRO_VIDEO_RECAST_USD_MICROS_PER_SECOND = 168_000;
export const VIDEO_RECAST_MIN_DURATION_SECONDS = 3;
export const VIDEO_RECAST_MAX_DURATION_SECONDS = 15.05;

export class UgcVideoRecastInputError extends Error {
  constructor(
    readonly code:
      | "VIDEO_RECAST_OWNER_ONLY"
      | "VIDEO_RECAST_MODEL_UNSUPPORTED"
      | "VIDEO_RECAST_PROMPT_REQUIRED"
      | "PROVIDER_REFERENCE_TOKEN_UNSUPPORTED"
      | "VIDEO_REQUIRED"
      | "CHARACTER_OUTFIT_REQUIRED"
      | "REFERENCE_INVALID"
      | "UNSUPPORTED_VIDEO"
      | "UNSUPPORTED_IMAGE"
      | "VIDEO_DURATION_INVALID"
      | "VIDEO_INPUT_UNSUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "UgcVideoRecastInputError";
  }
}

const PROVIDER_REFERENCE_TOKEN_PATTERN = /@(image|video|element)\d+\b/iu;
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"];
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** User instructions stay provider-neutral; Xeriamo owns every fal token. */
export function assertUgcVideoRecastUserPrompt(input: string): void {
  const prompt = input.trim();
  if (!prompt) {
    throw new UgcVideoRecastInputError(
      "VIDEO_RECAST_PROMPT_REQUIRED",
      "Beschreibe, wie das Video neu inszeniert werden soll.",
    );
  }
  if (PROVIDER_REFERENCE_TOKEN_PATTERN.test(prompt)) {
    throw new UgcVideoRecastInputError(
      "PROVIDER_REFERENCE_TOKEN_UNSUPPORTED",
      "Entferne @Image-, @Video- und @Element-Verweise. Xeriamo ordnet Quellvideo und Referenzbilder automatisch zu.",
    );
  }
}

export type UgcVideoRecastReferenceResolution = {
  sourceVideo: UgcVideoReferenceMetadata;
  characterOutfit: UgcVideoReferenceMetadata;
  face: UgcVideoReferenceMetadata | null;
  sceneStyle: UgcVideoReferenceMetadata | null;
};

export function requireUgcVideoRecastSettings(
  setup: UgcVideoGenerationSetup,
): UgcVideoRecastSettings {
  if (setup.mode !== "VIDEO_RECAST" || !setup.videoRecast) {
    throw new UgcVideoRecastInputError(
      "REFERENCE_INVALID",
      "Das Setup für Video neu inszenieren ist unvollständig.",
    );
  }
  return setup.videoRecast;
}

function requiredReference(
  setup: UgcVideoGenerationSetup,
  id: string | null,
  input: {
    mediaType: "IMAGE" | "VIDEO";
    role: "MOTION" | "OUTFIT" | "FACE" | "SCENE";
    code: "VIDEO_REQUIRED" | "CHARACTER_OUTFIT_REQUIRED";
    message: string;
  },
): UgcVideoReferenceMetadata {
  const reference = id
    ? setup.references.find((item) => item.id === id) ?? null
    : null;
  if (
    !reference ||
    reference.mediaType !== input.mediaType ||
    reference.role !== input.role
  ) {
    throw new UgcVideoRecastInputError(input.code, input.message);
  }
  return reference;
}

function optionalReference(
  setup: UgcVideoGenerationSetup,
  id: string | null,
  role: "FACE" | "SCENE",
): UgcVideoReferenceMetadata | null {
  if (!id) return null;
  const reference = setup.references.find((item) => item.id === id) ?? null;
  if (
    !reference ||
    reference.mediaType !== "IMAGE" ||
    reference.role !== role
  ) {
    throw new UgcVideoRecastInputError(
      "REFERENCE_INVALID",
      "Mindestens eine Referenz ist dem falschen Upload-Feld zugeordnet.",
    );
  }
  return reference;
}

export function resolveUgcVideoRecastReferences(
  setup: UgcVideoGenerationSetup,
): UgcVideoRecastReferenceResolution {
  if (
    setup.mode !== "VIDEO_RECAST" ||
    setup.modelId !== KLING_O3_PRO_VIDEO_RECAST_MODEL_ID
  ) {
    throw new UgcVideoRecastInputError(
      "VIDEO_RECAST_MODEL_UNSUPPORTED",
      "Dieses Modell unterstützt Video neu inszenieren nicht.",
    );
  }
  const settings = requireUgcVideoRecastSettings(setup);
  const sourceVideo = requiredReference(
    setup,
    settings.sourceVideoReferenceId,
    {
      mediaType: "VIDEO",
      role: "MOTION",
      code: "VIDEO_REQUIRED",
      message: "Bitte lade ein Quellvideo hoch.",
    },
  );
  const characterOutfit = requiredReference(
    setup,
    settings.characterOutfitReferenceId,
    {
      mediaType: "IMAGE",
      role: "OUTFIT",
      code: "CHARACTER_OUTFIT_REQUIRED",
      message: "Bitte lade ein Model-/Outfit-Bild hoch.",
    },
  );
  const face = optionalReference(
    setup,
    settings.faceReferenceId,
    "FACE",
  );
  const sceneStyle = optionalReference(
    setup,
    settings.sceneStyleReferenceId,
    "SCENE",
  );
  const expected = [sourceVideo, characterOutfit, face, sceneStyle].filter(
    (reference): reference is UgcVideoReferenceMetadata => Boolean(reference),
  );
  const unique = new Set(expected.map((reference) => reference.id));
  if (
    expected.length !== setup.references.length ||
    unique.size !== expected.length ||
    expected.some(
      (reference, index) =>
        setup.references[index]?.id !== reference.id ||
        reference.order !== index,
    )
  ) {
    throw new UgcVideoRecastInputError(
      "REFERENCE_INVALID",
      "Die Referenzen konnten nicht eindeutig den Upload-Feldern zugeordnet werden.",
    );
  }
  return { sourceVideo, characterOutfit, face, sceneStyle };
}

export function assertUgcVideoRecastSetup(
  setup: UgcVideoGenerationSetup,
): UgcVideoRecastReferenceResolution {
  assertUgcVideoRecastUserPrompt(setup.prompt);
  const resolved = resolveUgcVideoRecastReferences(setup);
  if (!VIDEO_MIME_TYPES.includes(resolved.sourceVideo.mimeType.toLowerCase())) {
    throw new UgcVideoRecastInputError(
      "UNSUPPORTED_VIDEO",
      "Das Quellvideo muss als MP4 oder MOV vorliegen.",
    );
  }
  for (const reference of [
    resolved.characterOutfit,
    resolved.face,
    resolved.sceneStyle,
  ]) {
    if (reference && !IMAGE_MIME_TYPES.includes(reference.mimeType.toLowerCase())) {
      throw new UgcVideoRecastInputError(
        "UNSUPPORTED_IMAGE",
        "Die Bildreferenzen müssen als PNG, JPEG oder WebP vorliegen.",
      );
    }
  }
  const duration = requireUgcVideoRecastSettings(setup).sourceDurationSeconds;
  if (
    duration !== null &&
    (duration < VIDEO_RECAST_MIN_DURATION_SECONDS ||
      duration > VIDEO_RECAST_MAX_DURATION_SECONDS)
  ) {
    throw new UgcVideoRecastInputError(
      "VIDEO_DURATION_INVALID",
      "Das Quellvideo muss zwischen 3 und 15 Sekunden lang sein.",
    );
  }
  // One character Element plus at most one image_urls reference remains below
  // Kling O3's combined Element/image-reference ceiling of four.
  const combinedProviderReferences = 1 + (resolved.sceneStyle ? 1 : 0);
  if (combinedProviderReferences > 4) {
    throw new UgcVideoRecastInputError(
      "REFERENCE_INVALID",
      "Für Kling O3 sind zu viele kombinierte Referenzen ausgewählt.",
    );
  }
  return resolved;
}

export function assertUgcVideoRecastImageDimensions(input: {
  role: "CHARACTER_OUTFIT" | "FACE" | "SCENE_STYLE";
  width: number;
  height: number;
}): void {
  if (
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    input.width < 300 ||
    input.height < 300
  ) {
    throw new UgcVideoRecastInputError(
      "UNSUPPORTED_IMAGE",
      "Die Bildreferenz benötigt mindestens 300 × 300 Pixel.",
    );
  }
  const ratio = input.width / input.height;
  if (ratio < 0.4 || ratio > 2.5) {
    throw new UgcVideoRecastInputError(
      "UNSUPPORTED_IMAGE",
      "Das Seitenverhältnis der Bildreferenz wird nicht unterstützt.",
    );
  }
}

export function estimateUgcVideoRecastCostUsd(
  sourceDurationSeconds: number,
): number {
  if (
    !Number.isFinite(sourceDurationSeconds) ||
    sourceDurationSeconds < VIDEO_RECAST_MIN_DURATION_SECONDS ||
    sourceDurationSeconds > VIDEO_RECAST_MAX_DURATION_SECONDS
  ) {
    throw new UgcVideoRecastInputError(
      "VIDEO_DURATION_INVALID",
      "Die Quelldauer konnte nicht sicher bepreist werden.",
    );
  }
  return (
    KLING_O3_PRO_VIDEO_RECAST_USD_MICROS_PER_SECOND * sourceDurationSeconds
  ) / 1_000_000;
}
