import { createHash } from "node:crypto";

import { createCanvas, loadImage } from "canvas";

import type { NormalizedBounds } from "@/lib/image/deterministic-runtime/garment-registration-v3";
import {
  DEPTH_ESTIMATION_CONTRACT_VERSION,
  depthEstimationProvenanceSchema,
  type DepthEstimationPolicy,
  type DepthEstimationProviderResult,
  type ValidatedDepthEstimation,
} from "@/lib/image/depth-estimation/types";

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

export function depthEstimationIdempotencyKey(input: {
  jobId: string;
  sourceBaseChecksumSha256: string;
  provider: string;
  model: string;
  adapterVersion: string;
}): string {
  return `nexhq-depth:${sha256(
    [
      input.jobId,
      input.sourceBaseChecksumSha256,
      input.provider,
      input.model,
      input.adapterVersion,
    ].join(":"),
  )}`;
}

export async function validateDepthEstimation(input: {
  policy: DepthEstimationPolicy;
  result: DepthEstimationProviderResult;
  jobId: string;
  sourceBaseChecksumSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  printableRegion: NormalizedBounds;
  idempotencyKey: string;
}): Promise<ValidatedDepthEstimation> {
  if (
    input.result.jobId !== input.jobId ||
    input.result.sourceBaseChecksumSha256 !== input.sourceBaseChecksumSha256
  ) {
    throw new Error("SOURCE_BINDING_MISMATCH");
  }
  const decoded = await loadImage(input.result.depthMapBytes).catch(() => null);
  if (!decoded) throw new Error("DEPTH_DECODE_FAILED");
  if (
    decoded.width !== input.result.outputWidth ||
    decoded.height !== input.result.outputHeight ||
    decoded.width < 16 ||
    decoded.height < 16
  ) {
    throw new Error("DEPTH_DIMENSIONS_INVALID");
  }

  const output = createCanvas(input.sourceWidth, input.sourceHeight);
  const context = output.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.drawImage(decoded, 0, 0, input.sourceWidth, input.sourceHeight);
  const pixels = context.getImageData(0, 0, input.sourceWidth, input.sourceHeight);
  const values: number[] = [];
  const left = Math.max(0, Math.floor(input.printableRegion.x * input.sourceWidth));
  const right = Math.min(
    input.sourceWidth - 1,
    Math.ceil((input.printableRegion.x + input.printableRegion.width) * input.sourceWidth),
  );
  const top = Math.max(0, Math.floor(input.printableRegion.y * input.sourceHeight));
  const bottom = Math.min(
    input.sourceHeight - 1,
    Math.ceil((input.printableRegion.y + input.printableRegion.height) * input.sourceHeight),
  );
  for (let y = top; y <= bottom; y += 2) {
    for (let x = left; x <= right; x += 2) {
      const offset = (y * input.sourceWidth + x) * 4;
      const luminance =
        (pixels.data[offset]! * 0.2126 +
          pixels.data[offset + 1]! * 0.7152 +
          pixels.data[offset + 2]! * 0.0722) /
        255;
      values.push(luminance);
    }
  }
  const p05 = quantile(values, 0.05);
  const p95 = quantile(values, 0.95);
  const dynamicRange = Math.max(0, p95 - p05);
  if (dynamicRange < input.policy.minimumDynamicRange) {
    throw new Error("DEPTH_DYNAMIC_RANGE_WEAK");
  }

  let discontinuities = 0;
  let comparisons = 0;
  for (let y = top + 1; y < bottom; y += 2) {
    for (let x = left + 1; x < right; x += 2) {
      const at = (px: number, py: number) => {
        const offset = (py * input.sourceWidth + px) * 4;
        return (
          pixels.data[offset]! * 0.2126 +
          pixels.data[offset + 1]! * 0.7152 +
          pixels.data[offset + 2]! * 0.0722
        ) / 255;
      };
      const center = at(x, y);
      comparisons += 2;
      if (Math.abs(center - at(x + 1, y)) > dynamicRange * 0.72)
        discontinuities += 1;
      if (Math.abs(center - at(x, y + 1)) > dynamicRange * 0.72)
        discontinuities += 1;
    }
  }
  const discontinuityFraction = comparisons
    ? discontinuities / comparisons
    : 1;
  if (discontinuityFraction > input.policy.maximumDiscontinuityFraction) {
    throw new Error("DEPTH_DISCONTINUITY_UNSAFE");
  }

  // Freeze a normalized grayscale map. This preserves the provider's relative
  // depth evidence while giving downstream code an exact Base-sized raster.
  const normalized = context.createImageData(input.sourceWidth, input.sourceHeight);
  const denominator = Math.max(1e-6, dynamicRange);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const value =
      (pixels.data[offset]! * 0.2126 +
        pixels.data[offset + 1]! * 0.7152 +
        pixels.data[offset + 2]! * 0.0722) /
      255;
    const gray = Math.round(Math.max(0, Math.min(1, (value - p05) / denominator)) * 255);
    normalized.data[offset] = gray;
    normalized.data[offset + 1] = gray;
    normalized.data[offset + 2] = gray;
    normalized.data[offset + 3] = 255;
  }
  context.putImageData(normalized, 0, 0);
  const normalizedDepthMapPngBytes = output.toBuffer("image/png");
  const depthMapChecksumSha256 = sha256(normalizedDepthMapPngBytes);
  const provenance = depthEstimationProvenanceSchema.parse({
    contractVersion: DEPTH_ESTIMATION_CONTRACT_VERSION,
    policy: input.policy,
    status: "VALIDATED",
    validationReason: "ACCEPTED",
    provider: input.result.provider,
    model: input.result.model,
    adapterVersion: input.result.adapterVersion,
    providerRequestId: input.result.providerRequestId,
    jobId: input.jobId,
    sourceBaseChecksumSha256: input.sourceBaseChecksumSha256,
    idempotencyKeyHash: sha256(input.idempotencyKey),
    sourceDimensions: { width: input.sourceWidth, height: input.sourceHeight },
    providerOutputDimensions: {
      width: input.result.outputWidth,
      height: input.result.outputHeight,
    },
    normalizedDimensions: { width: input.sourceWidth, height: input.sourceHeight },
    depthMapChecksumSha256,
    normalization: {
      version: "nexhq-relative-depth-normalization-v1",
      channel: "LUMINANCE",
      orientation: "RELATIVE_ONLY_UNKNOWN_POLARITY",
      p05,
      p95,
      dynamicRange,
      discontinuityFraction,
    },
    realDepth: true,
    artworkInputIncluded: false,
  });
  return {
    provenance: provenance as ValidatedDepthEstimation["provenance"],
    normalizedDepthMapPngBytes,
  };
}

export function rejectedDepthProvenance(input: {
  policy: DepthEstimationPolicy;
  jobId: string;
  sourceBaseChecksumSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  idempotencyKey: string;
  reason: Exclude<
    import("@/lib/image/depth-estimation/types").DepthEstimationProvenance["validationReason"],
    "ACCEPTED"
  >;
  providerRequestId?: string | null;
}) {
  return depthEstimationProvenanceSchema.parse({
    contractVersion: DEPTH_ESTIMATION_CONTRACT_VERSION,
    policy: input.policy,
    status: "REJECTED",
    validationReason: input.reason,
    provider: input.policy.provider,
    model: input.policy.model,
    adapterVersion: input.policy.adapterVersion,
    providerRequestId: input.providerRequestId ?? null,
    jobId: input.jobId,
    sourceBaseChecksumSha256: input.sourceBaseChecksumSha256,
    idempotencyKeyHash: sha256(input.idempotencyKey),
    sourceDimensions: { width: input.sourceWidth, height: input.sourceHeight },
    providerOutputDimensions: null,
    normalizedDimensions: null,
    depthMapChecksumSha256: null,
    normalization: null,
    realDepth: true,
    artworkInputIncluded: false,
  });
}
