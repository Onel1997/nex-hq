import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";

import type { UgcVideoGenerationSetup } from "@/lib/ugc-video-studio/contracts";
import {
  ugcVideoModelById,
  type UgcVideoEditMediaProfile,
} from "@/lib/ugc-video-studio/model-registry";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import {
  resolveUgcVideoEditReferences,
  UgcVideoEditInputError,
} from "@/lib/ugc-video-studio/video-edit-config";

const FFMPEG_TIMEOUT_MS = 50_000;
const INSPECTION_LOG_LIMIT = 128 * 1024;
const DURATION_TOLERANCE_SECONDS = 0.3;

export type UgcVideoInspection = {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  byteLength: number;
  mimeType: "video/mp4";
  hasAudio: boolean;
};

export type UgcVideoNormalizationPlan = {
  width: number;
  height: number;
  fps: number;
  resizeRequired: boolean;
  fpsConversionRequired: boolean;
};

export type UgcVideoEditMediaProcessor = {
  inspect(bytes: Buffer, mimeType: string): Promise<UgcVideoInspection>;
  trim(input: {
    bytes: Buffer;
    mimeType: string;
    durationSeconds: number;
    keepAudio: boolean;
  }): Promise<Buffer>;
  normalize(input: {
    bytes: Buffer;
    width: number;
    height: number;
    fps: number | null;
    durationSeconds: number;
    keepAudio: boolean;
  }): Promise<Buffer>;
};

function even(value: number, direction: "UP" | "DOWN" | "NEAREST") {
  const divided = value / 2;
  if (direction === "UP") return Math.max(2, Math.ceil(divided) * 2);
  if (direction === "DOWN") return Math.max(2, Math.floor(divided) * 2);
  return Math.max(2, Math.round(divided) * 2);
}

function dimensionsMatchProfile(
  width: number,
  height: number,
  profile: UgcVideoEditMediaProfile,
) {
  if (profile.dimensionPolicy === "AXIS_BOUNDS") {
    return width >= profile.minWidth && height >= profile.minHeight &&
      width <= profile.maxWidth && height <= profile.maxHeight;
  }
  const area = width * height;
  return area >= profile.minPixelArea && area <= profile.maxPixelArea &&
    Math.max(width, height) <= profile.maxLongEdge;
}

/** Pure, aspect-ratio-preserving planning authority used before FFmpeg runs. */
export function planUgcVideoEditNormalization(input: {
  width: number;
  height: number;
  fps: number;
  profile: UgcVideoEditMediaProfile;
}): UgcVideoNormalizationPlan {
  if (
    !Number.isInteger(input.width) || !Number.isInteger(input.height) ||
    input.width <= 0 || input.height <= 0 ||
    !Number.isFinite(input.fps) || input.fps <= 0
  ) {
    throw new UgcVideoEditInputError(
      "VIDEO_INPUT_UNSUPPORTED",
      "Das Video konnte nicht für das ausgewählte Modell vorbereitet werden.",
    );
  }

  let scale = 1;
  let scaleDirection: "UP" | "DOWN" | "NEAREST" = "NEAREST";
  if (input.profile.dimensionPolicy === "AXIS_BOUNDS") {
    const minimumScale = Math.max(
      input.profile.minWidth / input.width,
      input.profile.minHeight / input.height,
    );
    const maximumScale = Math.min(
      input.profile.maxWidth / input.width,
      input.profile.maxHeight / input.height,
    );
    if (minimumScale > maximumScale + Number.EPSILON) {
      throw new UgcVideoEditInputError(
        "VIDEO_INPUT_UNSUPPORTED",
        "Das Seitenverhältnis des Videos wird vom ausgewählten Modell nicht unterstützt.",
      );
    }
    if (minimumScale > 1) {
      scale = minimumScale;
      scaleDirection = "UP";
    } else if (maximumScale < 1) {
      scale = maximumScale;
      scaleDirection = "DOWN";
    }
  } else {
    const area = input.width * input.height;
    if (area < input.profile.minPixelArea) {
      scale = Math.sqrt(input.profile.minPixelArea / area);
      scaleDirection = "UP";
    } else if (
      area > input.profile.maxPixelArea ||
      Math.max(input.width, input.height) > input.profile.maxLongEdge
    ) {
      scale = Math.min(
        Math.sqrt(input.profile.maxPixelArea / area),
        input.profile.maxLongEdge / Math.max(input.width, input.height),
      );
      scaleDirection = "DOWN";
    }
  }

  let width = even(input.width * scale, scaleDirection);
  let height = even(input.height * scale, scaleDirection);
  if (!dimensionsMatchProfile(width, height, input.profile)) {
    // Even H.264 dimensions can move an edge by one pixel. Try the adjacent
    // even candidates without cropping, padding or changing the scale model.
    const offsets = scaleDirection === "DOWN" ? [0, -2, 2] : [0, 2, -2];
    const candidates = offsets.flatMap((widthOffset) =>
      offsets.map((heightOffset) => ({
        width: Math.max(2, width + widthOffset),
        height: Math.max(2, height + heightOffset),
      })),
    );
    const candidate = candidates
      .filter((item) => dimensionsMatchProfile(item.width, item.height, input.profile))
      .sort((left, right) => {
        const sourceRatio = input.width / input.height;
        return Math.abs(left.width / left.height - sourceRatio) -
          Math.abs(right.width / right.height - sourceRatio);
      })[0];
    if (!candidate) {
      throw new UgcVideoEditInputError(
        "VIDEO_INPUT_UNSUPPORTED",
        "Das Video konnte nicht proportional vorbereitet werden.",
      );
    }
    width = candidate.width;
    height = candidate.height;
  }

  const fpsOutOfRange =
    (input.profile.minFps !== null && input.fps < input.profile.minFps) ||
    (input.profile.maxFps !== null && input.fps > input.profile.maxFps);
  return {
    width,
    height,
    fps: fpsOutOfRange ? input.profile.normalizedFps : input.fps,
    resizeRequired: width !== input.width || height !== input.height,
    fpsConversionRequired: fpsOutOfRange,
  };
}

async function runFfmpeg(
  args: string[],
  options: { acceptFailure?: boolean } = {},
): Promise<string> {
  const executable = ffmpegPath;
  if (!executable) throw new Error("UGC_VIDEO_FFMPEG_UNAVAILABLE");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: "pipe" });
    child.stdin.end();
    let stderr = "";
    let timedOut = false;
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < INSPECTION_LOG_LIMIT) {
        stderr += chunk.toString("utf8").slice(0, INSPECTION_LOG_LIMIT - stderr.length);
      }
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error("UGC_VIDEO_FFMPEG_TIMEOUT"));
      if (code !== 0 && !options.acceptFailure) {
        return reject(new Error("UGC_VIDEO_FFMPEG_PROCESS_FAILED"));
      }
      resolve(stderr);
    });
  });
}

function parseFfmpegInspection(stderr: string, byteLength: number): UgcVideoInspection {
  const duration = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  const videoLine = stderr.split("\n").find((line) => /Stream .*Video:/i.test(line));
  const dimensions = videoLine?.match(/(?:^|[,\s])(\d{2,5})x(\d{2,5})(?:\s|\[|,)/);
  const fps = videoLine?.match(/(\d+(?:\.\d+)?)\s+fps\b/i) ??
    videoLine?.match(/(\d+(?:\.\d+)?)\s+tbr\b/i);
  if (!duration || !dimensions || !fps) {
    throw new Error("UGC_VIDEO_FFMPEG_INSPECTION_FAILED");
  }
  let width = Number(dimensions[1]);
  let height = Number(dimensions[2]);
  const rotation = stderr.match(/rotation of\s+(-?\d+(?:\.\d+)?)\s+degrees/i);
  if (rotation && Math.abs(Math.round(Number(rotation[1])) / 90) % 2 === 1) {
    [width, height] = [height, width];
  }
  return {
    width,
    height,
    fps: Number(fps[1]),
    durationSeconds:
      Number(duration[1]) * 3_600 + Number(duration[2]) * 60 + Number(duration[3]),
    byteLength,
    mimeType: "video/mp4",
    hasAudio: stderr.split("\n").some((line) => /Stream .*Audio:/i.test(line)),
  };
}

async function withTemporaryDirectory<T>(run: (directory: string) => Promise<T>) {
  const directory = await mkdtemp(path.join(tmpdir(), "xeriamo-video-edit-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export const ffmpegVideoEditMediaProcessor: UgcVideoEditMediaProcessor = {
  async inspect(bytes) {
    return withTemporaryDirectory(async (directory) => {
      const inputPath = path.join(directory, "inspect.mp4");
      await writeFile(inputPath, bytes);
      const stderr = await runFfmpeg([
        "-hide_banner", "-i", inputPath,
        "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-",
      ]);
      return parseFfmpegInspection(stderr, bytes.byteLength);
    });
  },
  async trim(input) {
    return withTemporaryDirectory(async (directory) => {
      const inputPath = path.join(directory, "source.mp4");
      const outputPath = path.join(directory, "trimmed.mp4");
      await writeFile(inputPath, input.bytes);
      await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
        "-t", input.durationSeconds.toFixed(3),
        "-map", "0:v:0",
        ...(input.keepAudio ? ["-map", "0:a:0?"] : ["-an"]),
        "-c", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart",
        outputPath,
      ]);
      return readFile(outputPath);
    });
  },
  async normalize(input) {
    return withTemporaryDirectory(async (directory) => {
      const inputPath = path.join(directory, "trimmed.mp4");
      const outputPath = path.join(directory, "normalized.mp4");
      await writeFile(inputPath, input.bytes);
      const filters = [`scale=${input.width}:${input.height}:flags=lanczos`];
      if (input.fps !== null) filters.push(`fps=${input.fps}`);
      await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
        "-t", input.durationSeconds.toFixed(3),
        "-map", "0:v:0",
        ...(input.keepAudio ? ["-map", "0:a:0?"] : ["-an"]),
        "-vf", filters.join(","),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p",
        ...(input.keepAudio ? ["-c:a", "aac", "-b:a", "192k"] : []),
        "-movflags", "+faststart", outputPath,
      ]);
      return readFile(outputPath);
    });
  },
};

function assertPreparedVideo(input: {
  bytes: Buffer;
  inspection: UgcVideoInspection;
  profile: UgcVideoEditMediaProfile;
  durationSeconds: number;
  audioRequired: boolean;
  audioForbidden: boolean;
}) {
  const { inspection, profile } = input;
  if (
    !dimensionsMatchProfile(inspection.width, inspection.height, profile) ||
    inspection.durationSeconds < profile.minDurationSeconds - DURATION_TOLERANCE_SECONDS ||
    inspection.durationSeconds > profile.maxDurationSeconds + DURATION_TOLERANCE_SECONDS ||
    Math.abs(inspection.durationSeconds - input.durationSeconds) > DURATION_TOLERANCE_SECONDS ||
    (profile.minFps !== null && inspection.fps < profile.minFps) ||
    (profile.maxFps !== null && inspection.fps > profile.maxFps) ||
    inspection.byteLength > profile.maxBytes ||
    !profile.allowedMimeTypes.includes(inspection.mimeType) ||
    input.bytes.subarray(4, 8).toString("ascii") !== "ftyp" ||
    inspection.width % 2 !== 0 || inspection.height % 2 !== 0 ||
    (input.audioRequired && !inspection.hasAudio) ||
    (input.audioForbidden && inspection.hasAudio)
  ) {
    throw new UgcVideoEditInputError(
      "VIDEO_INPUT_UNSUPPORTED",
      "Das Video konnte nicht für das ausgewählte Modell vorbereitet werden.",
    );
  }
}

export async function prepareUgcVideoEditMedia(input: {
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
  trustedSourceDurationSeconds: number;
  processor?: UgcVideoEditMediaProcessor;
}): Promise<{ setup: UgcVideoGenerationSetup; references: UgcVideoProviderReference[] }> {
  const selectedDurationSeconds = Number(input.setup.duration);
  const source = resolveUgcVideoEditReferences(input.setup).sourceVideo;
  const sourceIndex = input.references.findIndex(
    (reference) => reference.metadata.id === source.id,
  );
  const sourceReference = input.references[sourceIndex];
  if (!sourceReference) throw new Error("UGC_VIDEO_EDIT_SOURCE_BYTES_REQUIRED");
  if (selectedDurationSeconds > input.trustedSourceDurationSeconds + 0.05) {
    throw new UgcVideoEditInputError(
      "VIDEO_TOO_LONG",
      "Das Quellvideo ist kürzer als die ausgewählte Dauer.",
    );
  }
  const profile = ugcVideoModelById(input.setup.modelId)?.videoEditMediaProfile;
  if (!profile) {
    throw new UgcVideoEditInputError(
      "MODEL_INPUT_UNSUPPORTED",
      "Für dieses Modell ist keine sichere Videovorbereitung verfügbar.",
    );
  }
  const processor = input.processor ?? ffmpegVideoEditMediaProcessor;
  try {
    const originalInspection = await processor.inspect(
      sourceReference.bytes,
      sourceReference.metadata.mimeType,
    );
    if (
      Math.abs(originalInspection.durationSeconds - input.trustedSourceDurationSeconds) > 1
    ) {
      throw new Error("UGC_VIDEO_TRUSTED_DURATION_MISMATCH");
    }
    const trimmedBytes = await processor.trim({
      bytes: sourceReference.bytes,
      mimeType: sourceReference.metadata.mimeType,
      durationSeconds: selectedDurationSeconds,
      keepAudio: input.setup.videoEdit.keepOriginalSound,
    });
    const trimmedInspection = await processor.inspect(trimmedBytes, "video/mp4");
    const plan = planUgcVideoEditNormalization({
      width: trimmedInspection.width,
      height: trimmedInspection.height,
      fps: trimmedInspection.fps,
      profile,
    });
    const requiresNormalization = plan.resizeRequired || plan.fpsConversionRequired;
    const preparedBytes = requiresNormalization
      ? await processor.normalize({
          bytes: trimmedBytes,
          width: plan.width,
          height: plan.height,
          fps: plan.fpsConversionRequired ? plan.fps : null,
          durationSeconds: selectedDurationSeconds,
          keepAudio: input.setup.videoEdit.keepOriginalSound,
        })
      : trimmedBytes;
    const preparedInspection = requiresNormalization
      ? await processor.inspect(preparedBytes, "video/mp4")
      : trimmedInspection;
    assertPreparedVideo({
      bytes: preparedBytes,
      inspection: preparedInspection,
      profile,
      durationSeconds: selectedDurationSeconds,
      audioRequired:
        input.setup.videoEdit.keepOriginalSound && originalInspection.hasAudio,
      audioForbidden: !input.setup.videoEdit.keepOriginalSound,
    });

    const preparedMetadata = {
      ...sourceReference.metadata,
      name: sourceReference.metadata.name.replace(/\.[^.]+$/, "") + ".mp4",
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
          reference.id === source.id ? preparedMetadata : reference,
        ),
      },
    };
  } catch (error) {
    if (error instanceof UgcVideoEditInputError) throw error;
    throw new UgcVideoEditInputError(
      "VIDEO_INPUT_UNSUPPORTED",
      "Das Video konnte nicht für das ausgewählte Modell vorbereitet werden.",
    );
  }
}
