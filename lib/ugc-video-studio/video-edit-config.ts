import type {
  UgcVideoGenerationSetup,
  UgcVideoReferenceMetadata,
} from "@/lib/ugc-video-studio/contracts";
import {
  isUgcVideoEditModelId,
  ugcVideoModelById,
  type UgcVideoEditModelId,
} from "@/lib/ugc-video-studio/model-registry";

export class UgcVideoEditInputError extends Error {
  constructor(
    readonly code:
      | "VIDEO_REQUIRED"
      | "CHARACTER_MASTER_REQUIRED"
      | "VIDEO_TOO_LONG"
      | "VIDEO_TOO_LARGE"
      | "UNSUPPORTED_VIDEO"
      | "UNSUPPORTED_IMAGE"
      | "VIDEO_INPUT_UNSUPPORTED"
      | "MODEL_INPUT_UNSUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "UgcVideoEditInputError";
  }
}

export type UgcVideoEditReferenceResolution = {
  sourceVideo: UgcVideoReferenceMetadata;
  characterMaster: UgcVideoReferenceMetadata;
};

function selectedReference(
  references: UgcVideoReferenceMetadata[],
  id: string | null,
  mediaType: "IMAGE" | "VIDEO",
): UgcVideoReferenceMetadata | null {
  if (id) {
    return references.find(
      (reference) => reference.id === id && reference.mediaType === mediaType,
    ) ?? null;
  }
  const candidates = references.filter((reference) => reference.mediaType === mediaType);
  return candidates.length === 1 ? candidates[0]! : null;
}

export function resolveUgcVideoEditReferences(
  setup: UgcVideoGenerationSetup,
): UgcVideoEditReferenceResolution {
  if (setup.mode !== "VIDEO_EDIT" || !isUgcVideoEditModelId(setup.modelId)) {
    throw new UgcVideoEditInputError(
      "MODEL_INPUT_UNSUPPORTED",
      "Dieses Modell unterstützt Video bearbeiten nicht.",
    );
  }
  const sourceVideo = selectedReference(
    setup.references,
    setup.videoEdit.sourceVideoReferenceId,
    "VIDEO",
  );
  if (!sourceVideo) {
    throw new UgcVideoEditInputError(
      "VIDEO_REQUIRED",
      "Bitte lade ein Quellvideo hoch.",
    );
  }
  const characterMaster = selectedReference(
    setup.references,
    setup.videoEdit.characterMasterReferenceId,
    "IMAGE",
  );
  if (!characterMaster) {
    throw new UgcVideoEditInputError(
      "CHARACTER_MASTER_REQUIRED",
      "Bitte lade dein Model / Mockup hoch.",
    );
  }
  return { sourceVideo, characterMaster };
}

export function assertUgcVideoEditSetup(
  setup: UgcVideoGenerationSetup,
): UgcVideoEditReferenceResolution {
  const resolved = resolveUgcVideoEditReferences(setup);
  const model = ugcVideoModelById(setup.modelId);
  if (!model || !isUgcVideoEditModelId(model.id)) {
    throw new UgcVideoEditInputError(
      "MODEL_INPUT_UNSUPPORTED",
      "Dieses Modell unterstützt Video bearbeiten nicht.",
    );
  }
  if (!model.supportedDurations.includes(setup.duration)) {
    throw new UgcVideoEditInputError(
      "VIDEO_TOO_LONG",
      `Für ${model.name} ist diese Videolänge nicht verfügbar.`,
    );
  }
  if (!["video/mp4", "video/quicktime", "video/x-m4v"].includes(
    resolved.sourceVideo.mimeType.toLowerCase(),
  )) {
    throw new UgcVideoEditInputError(
      "UNSUPPORTED_VIDEO",
      "Das Quellvideo muss als MP4 oder MOV vorliegen.",
    );
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(
    resolved.characterMaster.mimeType.toLowerCase(),
  )) {
    throw new UgcVideoEditInputError(
      "UNSUPPORTED_IMAGE",
      "Das Model / Mockup muss als PNG, JPEG oder WebP vorliegen.",
    );
  }
  if (setup.references.length !== 2) {
    throw new UgcVideoEditInputError(
      "MODEL_INPUT_UNSUPPORTED",
      "Video bearbeiten verwendet genau ein Quellvideo und ein Model / Mockup.",
    );
  }
  if (
    model.id === "seedance-2-fast-video-edit" &&
    resolved.sourceVideo.byteLength > 50 * 1024 * 1024
  ) {
    throw new UgcVideoEditInputError(
      "VIDEO_TOO_LARGE",
      "Das Quellvideo ist für Seedance 2 Fast zu groß.",
    );
  }
  if (
    model.characterReferenceStrategy === "KLING_ELEMENT" &&
    resolved.characterMaster.byteLength > 10 * 1024 * 1024
  ) {
    throw new UgcVideoEditInputError(
      "UNSUPPORTED_IMAGE",
      "Das Model / Mockup ist für Kling größer als 10 MB.",
    );
  }
  return resolved;
}

export function assertUgcVideoEditImageDimensions(input: {
  modelId: UgcVideoEditModelId;
  width: number;
  height: number;
}): void {
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width <= 0 || input.height <= 0) {
    throw new UgcVideoEditInputError("UNSUPPORTED_IMAGE", "Das Model / Mockup konnte nicht sicher geprüft werden.");
  }
  const model = ugcVideoModelById(input.modelId);
  if (model?.characterReferenceStrategy !== "KLING_ELEMENT") return;
  const ratio = input.width / input.height;
  if (input.width < 300 || input.height < 300 || ratio < 0.4 || ratio > 2.5) {
    throw new UgcVideoEditInputError(
      "UNSUPPORTED_IMAGE",
      "Das Model / Mockup benötigt für Kling mindestens 300 × 300 Pixel und ein geeignetes Seitenverhältnis.",
    );
  }
}

export function estimateUgcVideoEditCostUsd(input: {
  modelId: UgcVideoEditModelId;
  duration: UgcVideoGenerationSetup["duration"];
}): number {
  const model = ugcVideoModelById(input.modelId);
  if (!model?.providerCostUsdMicrosPerSecond) {
    throw new Error("UGC_VIDEO_EDIT_COST_UNAVAILABLE");
  }
  if (!model.supportedDurations.includes(input.duration)) {
    throw new Error("UGC_VIDEO_EDIT_DURATION_UNSUPPORTED");
  }
  const totalMicros = model.providerCostUsdMicrosPerSecond * Number(input.duration);
  return totalMicros / 1_000_000;
}
