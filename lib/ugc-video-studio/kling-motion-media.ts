import type { UgcVideoGenerationSetup } from "@/lib/ugc-video-studio/contracts";
import { resolveKlingMotionReferences } from "@/lib/ugc-video-studio/kling-motion-config";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import { clipIsoBmffFromStart } from "@/lib/xeriano/video-duration";

export function prepareKlingMotionMedia(input: {
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
  trustedSourceDurationSeconds: number;
}): {
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
} {
  const selectedDurationSeconds = Number(input.setup.duration);
  const motion = resolveKlingMotionReferences(input.setup).motionVideo;
  if (!motion) throw new Error("KLING_MOTION_VIDEO_REQUIRED");
  const motionIndex = input.references.findIndex(
    (reference) => reference.metadata.id === motion.id,
  );
  const source = input.references[motionIndex];
  if (!source) throw new Error("KLING_MOTION_VIDEO_BYTES_REQUIRED");
  if (selectedDurationSeconds > input.trustedSourceDurationSeconds + 0.05) {
    throw new Error("KLING_MOTION_SELECTED_DURATION_EXCEEDS_SOURCE");
  }

  const clippedBytes = Buffer.from(
    clipIsoBmffFromStart({
      bytes: source.bytes,
      mimeType: source.metadata.mimeType,
      durationSeconds: selectedDurationSeconds,
    }),
  );
  const clippedMetadata = {
    ...source.metadata,
    byteLength: clippedBytes.byteLength,
    durationSeconds: selectedDurationSeconds,
  };
  const references = input.references.map((reference, index) =>
    index === motionIndex
      ? { metadata: clippedMetadata, bytes: clippedBytes }
      : reference,
  );
  const setup = {
    ...input.setup,
    references: input.setup.references.map((reference) =>
      reference.id === motion.id ? clippedMetadata : reference,
    ),
  };
  return { setup, references };
}
