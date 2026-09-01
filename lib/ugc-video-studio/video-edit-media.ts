import type { UgcVideoGenerationSetup } from "@/lib/ugc-video-studio/contracts";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import { resolveUgcVideoEditReferences } from "@/lib/ugc-video-studio/video-edit-config";
import { clipIsoBmffFromStart } from "@/lib/xeriano/video-duration";

export function prepareUgcVideoEditMedia(input: {
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
  trustedSourceDurationSeconds: number;
}): { setup: UgcVideoGenerationSetup; references: UgcVideoProviderReference[] } {
  const selectedDurationSeconds = Number(input.setup.duration);
  const source = resolveUgcVideoEditReferences(input.setup).sourceVideo;
  const sourceIndex = input.references.findIndex(
    (reference) => reference.metadata.id === source.id,
  );
  const sourceReference = input.references[sourceIndex];
  if (!sourceReference) throw new Error("UGC_VIDEO_EDIT_SOURCE_BYTES_REQUIRED");
  if (selectedDurationSeconds > input.trustedSourceDurationSeconds + 0.05) {
    throw new Error("UGC_VIDEO_EDIT_SELECTED_DURATION_EXCEEDS_SOURCE");
  }
  const clippedBytes = Buffer.from(
    clipIsoBmffFromStart({
      bytes: sourceReference.bytes,
      mimeType: sourceReference.metadata.mimeType,
      durationSeconds: selectedDurationSeconds,
    }),
  );
  const clippedMetadata = {
    ...sourceReference.metadata,
    byteLength: clippedBytes.byteLength,
    durationSeconds: selectedDurationSeconds,
  };
  return {
    references: input.references.map((reference, index) =>
      index === sourceIndex
        ? { metadata: clippedMetadata, bytes: clippedBytes }
        : reference,
    ),
    setup: {
      ...input.setup,
      references: input.setup.references.map((reference) =>
        reference.id === source.id ? clippedMetadata : reference,
      ),
    },
  };
}
