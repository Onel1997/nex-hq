import type {
  UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import { KLING_O3_PRO_EDIT_MEDIA_PROFILE } from "@/lib/ugc-video-studio/model-registry";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import {
  ffmpegVideoEditMediaProcessor,
  planUgcVideoEditNormalization,
  type UgcVideoEditMediaProcessor,
  type UgcVideoInspection,
} from "@/lib/ugc-video-studio/video-edit-media";
import {
  resolveUgcVideoRecastReferences,
  requireUgcVideoRecastSettings,
  UgcVideoRecastInputError,
  VIDEO_RECAST_MAX_DURATION_SECONDS,
  VIDEO_RECAST_MIN_DURATION_SECONDS,
} from "@/lib/ugc-video-studio/video-recast-config";

const DURATION_TOLERANCE_SECONDS = 0.3;

function assertPreparedRecastVideo(input: {
  bytes: Buffer;
  inspection: UgcVideoInspection;
  durationSeconds: number;
  audioRequired: boolean;
  audioForbidden: boolean;
}) {
  const { inspection } = input;
  const profile = KLING_O3_PRO_EDIT_MEDIA_PROFILE;
  if (
    inspection.width < profile.minWidth ||
    inspection.height < profile.minHeight ||
    inspection.width > profile.maxWidth ||
    inspection.height > profile.maxHeight ||
    inspection.fps < profile.minFps ||
    inspection.fps > profile.maxFps ||
    inspection.durationSeconds <
      VIDEO_RECAST_MIN_DURATION_SECONDS - DURATION_TOLERANCE_SECONDS ||
    inspection.durationSeconds >
      VIDEO_RECAST_MAX_DURATION_SECONDS + DURATION_TOLERANCE_SECONDS ||
    Math.abs(inspection.durationSeconds - input.durationSeconds) >
      DURATION_TOLERANCE_SECONDS ||
    inspection.byteLength > profile.maxBytes ||
    input.bytes.subarray(4, 8).toString("ascii") !== "ftyp" ||
    inspection.width % 2 !== 0 ||
    inspection.height % 2 !== 0 ||
    (input.audioRequired && !inspection.hasAudio) ||
    (input.audioForbidden && inspection.hasAudio)
  ) {
    throw new UgcVideoRecastInputError(
      "VIDEO_INPUT_UNSUPPORTED",
      "Das Video konnte nicht für Video neu inszenieren vorbereitet werden.",
    );
  }
}

/**
 * Preserve the full trusted source duration while preparing an O3-compatible
 * private derivative. No existing VIDEO_EDIT duration/trim behavior is used or
 * changed by this additive mode.
 */
export async function prepareUgcVideoRecastMedia(input: {
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
  trustedSourceDurationSeconds: number;
  processor?: UgcVideoEditMediaProcessor;
}): Promise<{
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
}> {
  if (
    input.trustedSourceDurationSeconds < VIDEO_RECAST_MIN_DURATION_SECONDS ||
    input.trustedSourceDurationSeconds > VIDEO_RECAST_MAX_DURATION_SECONDS
  ) {
    throw new UgcVideoRecastInputError(
      "VIDEO_DURATION_INVALID",
      "Das Quellvideo muss zwischen 3 und 15 Sekunden lang sein.",
    );
  }
  const selected = resolveUgcVideoRecastReferences(input.setup);
  const settings = requireUgcVideoRecastSettings(input.setup);
  const sourceIndex = input.references.findIndex(
    (reference) => reference.metadata.id === selected.sourceVideo.id,
  );
  const source = input.references[sourceIndex];
  if (!source) {
    throw new UgcVideoRecastInputError(
      "VIDEO_REQUIRED",
      "Bitte lade ein Quellvideo hoch.",
    );
  }
  const processor = input.processor ?? ffmpegVideoEditMediaProcessor;
  try {
    const original = await processor.inspect(
      source.bytes,
      source.metadata.mimeType,
    );
    if (
      Math.abs(
        original.durationSeconds - input.trustedSourceDurationSeconds,
      ) > 1
    ) {
      throw new Error("UGC_VIDEO_RECAST_TRUSTED_DURATION_MISMATCH");
    }
    const remuxed = await processor.trim({
      bytes: source.bytes,
      mimeType: source.metadata.mimeType,
      durationSeconds: input.trustedSourceDurationSeconds,
      keepAudio: settings.keepAudio,
    });
    const remuxedInspection = await processor.inspect(remuxed, "video/mp4");
    const plan = planUgcVideoEditNormalization({
      width: remuxedInspection.width,
      height: remuxedInspection.height,
      fps: remuxedInspection.fps,
      profile: KLING_O3_PRO_EDIT_MEDIA_PROFILE,
    });
    const normalizationRequired =
      plan.resizeRequired || plan.fpsConversionRequired;
    const preparedBytes = normalizationRequired
      ? await processor.normalize({
          bytes: remuxed,
          width: plan.width,
          height: plan.height,
          fps: plan.fpsConversionRequired ? plan.fps : null,
          durationSeconds: input.trustedSourceDurationSeconds,
          keepAudio: settings.keepAudio,
        })
      : remuxed;
    const preparedInspection = normalizationRequired
      ? await processor.inspect(preparedBytes, "video/mp4")
      : remuxedInspection;
    assertPreparedRecastVideo({
      bytes: preparedBytes,
      inspection: preparedInspection,
      durationSeconds: input.trustedSourceDurationSeconds,
      audioRequired: settings.keepAudio && original.hasAudio,
      audioForbidden: !settings.keepAudio,
    });

    const preparedMetadata = {
      ...source.metadata,
      name: source.metadata.name.replace(/\.[^.]+$/, "") + ".mp4",
      mimeType: "video/mp4",
      byteLength: preparedBytes.byteLength,
      durationSeconds: preparedInspection.durationSeconds,
    };
    return {
      references: input.references.map((reference, index) =>
        index === sourceIndex
          ? { metadata: preparedMetadata, bytes: preparedBytes }
          : reference,
      ),
      setup: {
        ...input.setup,
        references: input.setup.references.map((reference) =>
          reference.id === source.metadata.id
            ? preparedMetadata
            : reference,
        ),
        videoRecast: {
          ...settings,
          sourceDurationSeconds: preparedInspection.durationSeconds,
        },
      },
    };
  } catch (error) {
    if (error instanceof UgcVideoRecastInputError) throw error;
    throw new UgcVideoRecastInputError(
      "VIDEO_INPUT_UNSUPPORTED",
      "Das Video konnte nicht für Video neu inszenieren vorbereitet werden.",
    );
  }
}
