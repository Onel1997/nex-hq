import type {
  UgcVideoGenerationSetup,
  UgcVideoReferenceMetadata,
} from "@/lib/ugc-video-studio/contracts";
import {
  UgcVideoCostCapError,
  parseUgcVideoCostCap,
} from "@/lib/ugc-video-studio/seedance-config";

export const KLING_V3_PRO_MOTION_CONTROL_MODEL_ID =
  "fal-ai/kling-video/v3/pro/motion-control" as const;
export const KLING_V3_PRO_MOTION_COST_CAP_ENV =
  "NEXHQ_UGC_KLING_MOTION_COST_MAX_USD" as const;
export const KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD = 0.168 as const;
export const KLING_V3_PRO_MOTION_PRICING_VERSION =
  "fal-public-per-second-2026-08-27" as const;
export const KLING_V3_PRO_MOTION_PRICING_SOURCE =
  "https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control" as const;

export const KLING_MOTION_MAX_SECONDS = {
  IMAGE: 10,
  VIDEO: 30,
} as const;

export type KlingMotionReferenceResolution = {
  characterImage: UgcVideoReferenceMetadata | null;
  motionVideo: UgcVideoReferenceMetadata | null;
  identityElement: UgcVideoReferenceMetadata | null;
  characterImageCandidates: UgcVideoReferenceMetadata[];
  motionVideoCandidates: UgcVideoReferenceMetadata[];
  identityElementCandidates: UgcVideoReferenceMetadata[];
  characterImageAmbiguous: boolean;
  motionVideoAmbiguous: boolean;
  identityElementAmbiguous: boolean;
};

function selectedReference(
  references: UgcVideoReferenceMetadata[],
  id: string | null,
  mediaType: "IMAGE" | "VIDEO",
): UgcVideoReferenceMetadata | null {
  if (!id) return null;
  return (
    references.find(
      (reference) => reference.id === id && reference.mediaType === mediaType,
    ) ?? null
  );
}

function resolvePreferred(
  all: UgcVideoReferenceMetadata[],
  preferred: UgcVideoReferenceMetadata[],
): { value: UgcVideoReferenceMetadata | null; ambiguous: boolean } {
  if (preferred.length === 1) return { value: preferred[0]!, ambiguous: false };
  if (preferred.length > 1) return { value: null, ambiguous: true };
  if (all.length === 1) return { value: all[0]!, ambiguous: false };
  return { value: null, ambiguous: all.length > 1 };
}

/**
 * Resolves only owner-provided garment/media metadata. No vision inference or
 * cross-domain identity gate is used. Explicit owner choices always win.
 */
export function resolveKlingMotionReferences(
  setup: Pick<UgcVideoGenerationSetup, "references" | "klingMotion">,
): KlingMotionReferenceResolution {
  const ordered = [...setup.references].sort((a, b) => a.order - b.order);
  const images = ordered.filter((reference) => reference.mediaType === "IMAGE");
  const videos = ordered.filter((reference) => reference.mediaType === "VIDEO");

  const explicitCharacter = selectedReference(
    ordered,
    setup.klingMotion.characterImageReferenceId,
    "IMAGE",
  );
  const preferredCharacters = images.filter(
    (reference) => reference.role === "MODEL" || reference.role === "IDENTITY",
  );
  const automaticCharacter = resolvePreferred(images, preferredCharacters);
  const characterImage = explicitCharacter ?? automaticCharacter.value;

  const explicitMotion = selectedReference(
    ordered,
    setup.klingMotion.motionVideoReferenceId,
    "VIDEO",
  );
  const preferredMotion = videos.filter(
    (reference) => reference.role === "MOTION",
  );
  const automaticMotion = resolvePreferred(videos, preferredMotion);
  const motionVideo = explicitMotion ?? automaticMotion.value;

  const identityElementCandidates = images.filter(
    (reference) =>
      reference.id !== characterImage?.id &&
      (reference.role === "FACE" || reference.role === "IDENTITY"),
  );
  const explicitIdentity = selectedReference(
    identityElementCandidates,
    setup.klingMotion.identityElementReferenceId,
    "IMAGE",
  );
  const automaticIdentity = resolvePreferred(
    identityElementCandidates,
    identityElementCandidates,
  );

  return {
    characterImage,
    motionVideo,
    identityElement:
      setup.klingMotion.characterOrientation === "VIDEO" &&
      setup.klingMotion.faceBindingEnabled
        ? explicitIdentity ?? automaticIdentity.value
        : null,
    characterImageCandidates: images,
    motionVideoCandidates: videos,
    identityElementCandidates,
    characterImageAmbiguous:
      !explicitCharacter && automaticCharacter.ambiguous,
    motionVideoAmbiguous: !explicitMotion && automaticMotion.ambiguous,
    identityElementAmbiguous:
      setup.klingMotion.faceBindingEnabled &&
      setup.klingMotion.characterOrientation === "VIDEO" &&
      !explicitIdentity &&
      automaticIdentity.ambiguous,
  };
}

export class KlingMotionReferenceError extends Error {
  readonly code = "KLING_MOTION_REFERENCES_INVALID" as const;

  constructor(
    message: string,
    readonly reason:
      | "CHARACTER_IMAGE_REQUIRED"
      | "MOTION_VIDEO_REQUIRED"
      | "CHARACTER_IMAGE_AMBIGUOUS"
      | "MOTION_VIDEO_AMBIGUOUS"
      | "IDENTITY_ELEMENT_AMBIGUOUS"
      | "IDENTITY_ELEMENT_REQUIRES_VIDEO_ORIENTATION"
      | "MOTION_VIDEO_TOO_LONG",
  ) {
    super(message);
    this.name = "KlingMotionReferenceError";
  }
}

export function assertKlingMotionReferences(
  setup: UgcVideoGenerationSetup,
): KlingMotionReferenceResolution {
  const resolution = resolveKlingMotionReferences(setup);
  if (resolution.characterImageAmbiguous) {
    throw new KlingMotionReferenceError(
      "Bitte wähle das Model-/Charakterbild eindeutig aus.",
      "CHARACTER_IMAGE_AMBIGUOUS",
    );
  }
  if (!resolution.characterImage) {
    throw new KlingMotionReferenceError(
      "Kling Motion Control benötigt ein Model-/Charakterbild.",
      "CHARACTER_IMAGE_REQUIRED",
    );
  }
  if (resolution.motionVideoAmbiguous) {
    throw new KlingMotionReferenceError(
      "Bitte wähle das Bewegungs-Referenzvideo eindeutig aus.",
      "MOTION_VIDEO_AMBIGUOUS",
    );
  }
  if (!resolution.motionVideo) {
    throw new KlingMotionReferenceError(
      "Kling Motion Control benötigt ein Bewegungs-Referenzvideo.",
      "MOTION_VIDEO_REQUIRED",
    );
  }
  if (resolution.identityElementAmbiguous) {
    throw new KlingMotionReferenceError(
      "Bitte wähle die zusätzliche Gesichtsreferenz eindeutig aus.",
      "IDENTITY_ELEMENT_AMBIGUOUS",
    );
  }
  if (
    setup.klingMotion.faceBindingEnabled &&
    setup.klingMotion.identityElementReferenceId &&
    setup.klingMotion.characterOrientation !== "VIDEO"
  ) {
    throw new KlingMotionReferenceError(
      "Die zusätzliche Gesichtsbindung ist nur mit „Bewegung folgen“ verfügbar.",
      "IDENTITY_ELEMENT_REQUIRES_VIDEO_ORIENTATION",
    );
  }
  const duration = resolution.motionVideo.durationSeconds;
  const maximum = KLING_MOTION_MAX_SECONDS[setup.klingMotion.characterOrientation];
  if (duration !== null && duration > maximum + 0.2) {
    throw new KlingMotionReferenceError(
      `Das Bewegungs-Referenzvideo darf bei dieser Ausrichtung maximal ${maximum} Sekunden lang sein.`,
      "MOTION_VIDEO_TOO_LONG",
    );
  }
  return resolution;
}

export function estimateKlingMotionMaximumCostUsd(input: {
  characterOrientation: UgcVideoGenerationSetup["klingMotion"]["characterOrientation"];
  motionDurationSeconds?: number | null;
}): number {
  const maximum = KLING_MOTION_MAX_SECONDS[input.characterOrientation];
  const billableSeconds =
    input.motionDurationSeconds && input.motionDurationSeconds > 0
      ? Math.min(input.motionDurationSeconds, maximum)
      : maximum;
  return Number(
    (billableSeconds * KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD).toFixed(2),
  );
}

export function assertKlingMotionCostAllowed(input: {
  setup: UgcVideoGenerationSetup;
  configuredCostCapUsd: number | null;
}): number {
  const resolution = assertKlingMotionReferences(input.setup);
  const estimatedMaximumCostUsd = estimateKlingMotionMaximumCostUsd({
    characterOrientation: input.setup.klingMotion.characterOrientation,
    motionDurationSeconds: resolution.motionVideo?.durationSeconds,
  });
  if (
    input.configuredCostCapUsd === null ||
    estimatedMaximumCostUsd > input.configuredCostCapUsd
  ) {
    throw new UgcVideoCostCapError(
      estimatedMaximumCostUsd,
      input.configuredCostCapUsd,
    );
  }
  return estimatedMaximumCostUsd;
}

export function getKlingMotionCostCap(
  environment: NodeJS.ProcessEnv = process.env,
): number | null {
  return parseUgcVideoCostCap(
    environment[KLING_V3_PRO_MOTION_COST_CAP_ENV],
  );
}
