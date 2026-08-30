import { createHash } from "node:crypto";

import { createCanvas, loadImage } from "canvas";

import type { NormalizedBounds } from "@/lib/image/deterministic-runtime/garment-registration-v3";
import {
  garmentSegmentationProvenanceSchema,
  type GarmentSegmentationPolicy,
  type GarmentSegmentationProviderResult,
  type ValidatedGarmentSegmentation,
} from "@/lib/image/garment-segmentation/types";
import type { ProductFamilySide } from "@/lib/product-library/product-family";

type ValidationReason = Exclude<
  ReturnType<typeof garmentSegmentationProvenanceSchema.parse>["validationReason"],
  "ACCEPTED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_RESPONSE_INVALID"
>;

type CandidateEvidence = {
  candidateId: string;
  normalizedMaskPngBytes: Buffer;
  checksumSha256: string;
  width: number;
  height: number;
  bounds: NormalizedBounds;
  foregroundFraction: number;
  largestComponentFraction: number;
  skinLikeFraction: number;
  hintOverlap: number;
  score: number;
  rejectionReason: ValidationReason | null;
};

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function garmentKind(
  productType: string,
): "TSHIRT" | "HOODIE" | "ZIP_HOODIE" | "JOGGER" | "OTHER" {
  const value = productType.toLocaleLowerCase("de-DE");
  if (/zip/.test(value) && /hood/.test(value)) return "ZIP_HOODIE";
  if (/hood/.test(value)) return "HOODIE";
  if (/jogger|pants|hose/.test(value)) return "JOGGER";
  if (/shirt|tee/.test(value)) return "TSHIRT";
  return "OTHER";
}

export function garmentSegmentationPrompt(productType: string): string {
  switch (garmentKind(productType)) {
    case "TSHIRT":
      return "the oversized t-shirt worn by the person";
    case "HOODIE":
      return "the hoodie worn by the person";
    case "ZIP_HOODIE":
      return "the zip hoodie worn by the person";
    case "JOGGER":
      return "the jogger pants worn by the person";
    default:
      return "garment worn by the person";
  }
}

function overlap(first: NormalizedBounds, second: NormalizedBounds): number {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union =
    first.width * first.height + second.width * second.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function skinLike(red: number, green: number, blue: number): boolean {
  const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
  const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
  return cb >= 76 && cb <= 127 && cr >= 132 && cr <= 178;
}

function componentMetrics(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let foreground = 0;
  let largest = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    foreground += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (visited[index]) continue;
    let head = 0;
    let tail = 0;
    let componentSize = 0;
    queue[tail++] = index;
    visited[index] = 1;
    while (head < tail) {
      const current = queue[head++]!;
      componentSize += 1;
      const cx = current % width;
      const cy = Math.floor(current / width);
      const neighbors = [
        cx > 0 ? current - 1 : -1,
        cx < width - 1 ? current + 1 : -1,
        cy > 0 ? current - width : -1,
        cy < height - 1 ? current + width : -1,
      ];
      for (const next of neighbors) {
        if (next >= 0 && mask[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    largest = Math.max(largest, componentSize);
  }
  return {
    foreground,
    largest,
    bounds:
      foreground > 0
        ? {
            x: minX / width,
            y: minY / height,
            width: (maxX - minX + 1) / width,
            height: (maxY - minY + 1) / height,
          }
        : null,
  };
}

async function candidateEvidence(input: {
  candidate: GarmentSegmentationProviderResult["candidates"][number];
  basePixels: Uint8ClampedArray;
  baseWidth: number;
  baseHeight: number;
  garmentType: string;
  registrationHint: NormalizedBounds | null;
  faceBounds: NormalizedBounds | null;
}): Promise<CandidateEvidence> {
  const image = await loadImage(input.candidate.maskPngBytes);
  if (
    image.width !== input.baseWidth ||
    image.height !== input.baseHeight ||
    input.candidate.maskWidth !== input.baseWidth ||
    input.candidate.maskHeight !== input.baseHeight
  ) {
    throw new Error("MASK_DIMENSIONS_MISMATCH");
  }
  const canvas = createCanvas(input.baseWidth, input.baseHeight);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const mask = new Uint8Array(input.baseWidth * input.baseHeight);
  let skinPixels = 0;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const alpha = pixels[offset + 3]!;
    const luminance =
      pixels[offset]! * 0.2126 +
      pixels[offset + 1]! * 0.7152 +
      pixels[offset + 2]! * 0.0722;
    const foreground = alpha >= 128 && luminance >= 128;
    if (!foreground) continue;
    mask[index] = 1;
    if (
      skinLike(
        input.basePixels[offset]!,
        input.basePixels[offset + 1]!,
        input.basePixels[offset + 2]!,
      )
    ) {
      skinPixels += 1;
    }
  }
  const metrics = componentMetrics(mask, input.baseWidth, input.baseHeight);
  const bounds = metrics.bounds ?? { x: 0, y: 0, width: 1, height: 1 };
  const foregroundFraction = metrics.foreground / mask.length;
  const largestComponentFraction =
    metrics.foreground > 0 ? metrics.largest / metrics.foreground : 0;
  const skinLikeFraction =
    metrics.foreground > 0 ? skinPixels / metrics.foreground : 1;
  const hintOverlap = input.registrationHint
    ? overlap(bounds, input.registrationHint)
    : 0;
  const kind = garmentKind(input.garmentType);
  const centerY = bounds.y + bounds.height / 2;
  const faceOverlap = input.faceBounds ? overlap(bounds, input.faceBounds) : 0;
  let rejectionReason: ValidationReason | null = null;
  if (metrics.foreground === 0 || foregroundFraction < 0.015) {
    rejectionReason = "TINY_MASK";
  } else if (foregroundFraction > 0.68 || bounds.width * bounds.height > 0.82) {
    rejectionReason = "BACKGROUND_SIZED_MASK";
  } else if (largestComponentFraction < (kind === "JOGGER" ? 0.5 : 0.72)) {
    rejectionReason = "DISCONNECTED_MASK";
  } else if (
    faceOverlap > 0.08 ||
    (skinLikeFraction > 0.72 &&
      input.faceBounds != null &&
      bounds.y <
        input.faceBounds.y + input.faceBounds.height * 1.25)
  ) {
    rejectionReason = "SKIN_OR_BODY_MASK";
  } else if (kind === "OTHER") {
    rejectionReason = "GARMENT_TYPE_MISMATCH";
  } else if (
    kind === "JOGGER"
      ? centerY < 0.47 || bounds.height < 0.28
      : centerY < 0.28 || centerY > 0.78 || bounds.width < 0.16 || bounds.height < 0.2
  ) {
    rejectionReason = "IMPLAUSIBLE_POSITION";
  }

  const normalizedCanvas = createCanvas(input.baseWidth, input.baseHeight);
  const normalizedContext = normalizedCanvas.getContext("2d");
  const normalized = normalizedContext.createImageData(
    input.baseWidth,
    input.baseHeight,
  );
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const offset = index * 4;
    normalized.data[offset] = 255;
    normalized.data[offset + 1] = 255;
    normalized.data[offset + 2] = 255;
    normalized.data[offset + 3] = 255;
  }
  normalizedContext.putImageData(normalized, 0, 0);
  const normalizedMaskPngBytes = normalizedCanvas.toBuffer("image/png");
  const expectedCenterY = kind === "JOGGER" ? 0.7 : 0.5;
  const positionScore = Math.max(0, 1 - Math.abs(centerY - expectedCenterY) / 0.5);
  const sizeTarget = kind === "JOGGER" ? 0.24 : 0.2;
  const sizeScore = Math.max(
    0,
    1 - Math.abs(foregroundFraction - sizeTarget) / Math.max(sizeTarget, 0.1),
  );
  const confidence = input.candidate.confidence ?? 0.5;
  const score =
    hintOverlap * 0.42 +
    positionScore * 0.2 +
    sizeScore * 0.13 +
    largestComponentFraction * 0.12 +
    confidence * 0.13;
  return {
    candidateId: input.candidate.candidateId,
    normalizedMaskPngBytes,
    checksumSha256: sha256(normalizedMaskPngBytes),
    width: input.baseWidth,
    height: input.baseHeight,
    bounds,
    foregroundFraction,
    largestComponentFraction,
    skinLikeFraction,
    hintOverlap,
    score,
    rejectionReason,
  };
}

export async function validateGarmentSegmentation(input: {
  providerResult: GarmentSegmentationProviderResult;
  policy: GarmentSegmentationPolicy;
  baseImageBytes: Buffer;
  sourceBaseChecksumSha256: string;
  jobId: string;
  garmentType: string;
  side: ProductFamilySide;
  prompt: string;
  idempotencyKey: string;
  registrationHint: NormalizedBounds | null;
  faceBounds: NormalizedBounds | null;
}): Promise<
  | { ok: true; segmentation: ValidatedGarmentSegmentation }
  | {
      ok: false;
      provenance: ReturnType<typeof garmentSegmentationProvenanceSchema.parse>;
    }
> {
  const base = await loadImage(input.baseImageBytes);
  const baseCanvas = createCanvas(base.width, base.height);
  const baseContext = baseCanvas.getContext("2d");
  baseContext.drawImage(base, 0, 0);
  const basePixels = baseContext.getImageData(0, 0, base.width, base.height).data;
  const rejected = (reason: ValidationReason) => ({
    ok: false as const,
    provenance: garmentSegmentationProvenanceSchema.parse({
      contractVersion: "garment-segmentation-v1",
      policy: input.policy,
      status: "REJECTED",
      validationReason: reason,
      sourceBaseChecksumSha256: input.sourceBaseChecksumSha256,
      jobId: input.jobId,
      garmentType: input.garmentType,
      side: input.side,
      provider: input.providerResult.provider,
      model: input.providerResult.model,
      providerVersion: input.providerResult.providerVersion,
      providerRequestId: input.providerResult.providerRequestId,
      candidateCount: input.providerResult.candidates.length,
      selectedCandidateId: null,
      mask: null,
      prompt: input.prompt,
      idempotencyKeyHash: sha256(input.idempotencyKey),
    }),
  });
  if (
    input.providerResult.sourceBaseChecksumSha256 !==
      input.sourceBaseChecksumSha256 ||
    input.providerResult.jobId !== input.jobId ||
    input.providerResult.provider !== input.policy.provider ||
    input.providerResult.model !== input.policy.model
  ) {
    return rejected("SOURCE_BINDING_MISMATCH");
  }
  if (!input.providerResult.candidates.length) return rejected("NO_CANDIDATES");
  const evidence: CandidateEvidence[] = [];
  let dimensionMismatch = false;
  for (const candidate of input.providerResult.candidates) {
    try {
      evidence.push(
        await candidateEvidence({
          candidate,
          basePixels,
          baseWidth: base.width,
          baseHeight: base.height,
          garmentType: input.garmentType,
          registrationHint: input.registrationHint,
          faceBounds: input.faceBounds,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message === "MASK_DIMENSIONS_MISMATCH") {
        dimensionMismatch = true;
        continue;
      }
      throw error;
    }
  }
  const accepted = evidence
    .filter((candidate) => candidate.rejectionReason === null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidateId.localeCompare(right.candidateId),
    );
  if (!accepted.length) {
    if (dimensionMismatch && !evidence.length) {
      return rejected("MASK_DIMENSIONS_MISMATCH");
    }
    return rejected(evidence[0]?.rejectionReason ?? "NO_SAFE_CANDIDATE");
  }
  const selected = accepted[0]!;
  const provenance = garmentSegmentationProvenanceSchema.parse({
    contractVersion: "garment-segmentation-v1",
    policy: input.policy,
    status: "VALIDATED",
    validationReason: "ACCEPTED",
    sourceBaseChecksumSha256: input.sourceBaseChecksumSha256,
    jobId: input.jobId,
    garmentType: input.garmentType,
    side: input.side,
    provider: input.providerResult.provider,
    model: input.providerResult.model,
    providerVersion: input.providerResult.providerVersion,
    providerRequestId: input.providerResult.providerRequestId,
    candidateCount: input.providerResult.candidates.length,
    selectedCandidateId: selected.candidateId,
    mask: {
      checksumSha256: selected.checksumSha256,
      width: selected.width,
      height: selected.height,
      bounds: selected.bounds,
      foregroundFraction: selected.foregroundFraction,
      largestComponentFraction: selected.largestComponentFraction,
      skinLikeFraction: selected.skinLikeFraction,
      hintOverlap: selected.hintOverlap,
      selectionScore: selected.score,
    },
    prompt: input.prompt,
    idempotencyKeyHash: sha256(input.idempotencyKey),
  });
  return {
    ok: true,
    segmentation: {
      provenance: provenance as ValidatedGarmentSegmentation["provenance"],
      normalizedMaskPngBytes: selected.normalizedMaskPngBytes,
    },
  };
}

export function rejectedSegmentationProvenance(input: {
  policy: GarmentSegmentationPolicy;
  sourceBaseChecksumSha256: string;
  jobId: string;
  garmentType: string;
  side: ProductFamilySide;
  prompt: string;
  idempotencyKey: string;
  reason: "PROVIDER_UNAVAILABLE" | "PROVIDER_RESPONSE_INVALID";
  providerVersion?: string;
}) {
  return garmentSegmentationProvenanceSchema.parse({
    contractVersion: "garment-segmentation-v1",
    policy: input.policy,
    status: "REJECTED",
    validationReason: input.reason,
    sourceBaseChecksumSha256: input.sourceBaseChecksumSha256,
    jobId: input.jobId,
    garmentType: input.garmentType,
    side: input.side,
    provider: input.policy.provider,
    model: input.policy.model,
    providerVersion: input.providerVersion ?? input.policy.adapterVersion,
    providerRequestId: null,
    candidateCount: 0,
    selectedCandidateId: null,
    mask: null,
    prompt: input.prompt,
    idempotencyKeyHash: sha256(input.idempotencyKey),
  });
}
