import { createHash } from "node:crypto";
import { createCanvas, loadImage } from "canvas";
import {
  MIDAS_NORMAL_CONTRACT_VERSION,
  normalEstimationProvenanceSchema,
  type NormalEstimationPolicy,
  type NormalEstimationProviderResult,
  type ValidatedNormalEstimation,
} from "@/lib/image/normal-estimation/types";

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
function decodeNormal(r: number, g: number, b: number) {
  const raw = { x: r / 127.5 - 1, y: 1 - g / 127.5, z: b / 127.5 - 1 };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  return length > 1e-6 && Number.isFinite(length)
    ? { x: raw.x / length, y: raw.y / length, z: raw.z / length }
    : null;
}

export function normalEstimationIdempotencyKey(input: { jobId: string; sourceBaseChecksumSha256: string; provider: string; model: string; adapterVersion: string }) {
  return `nexhq-midas-normal:${sha256([input.jobId, input.sourceBaseChecksumSha256, input.provider, input.model, input.adapterVersion].join(":"))}`;
}

export async function validateNormalEstimation(input: {
  policy: NormalEstimationPolicy;
  result: NormalEstimationProviderResult;
  jobId: string;
  sourceBaseChecksumSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  garmentMaskBytes: Buffer;
  idempotencyKey: string;
}): Promise<ValidatedNormalEstimation> {
  if (input.result.jobId !== input.jobId || input.result.sourceBaseChecksumSha256 !== input.sourceBaseChecksumSha256) throw new Error("SOURCE_BINDING_MISMATCH");
  const [decoded, mask] = await Promise.all([
    loadImage(input.result.normalMapBytes).catch(() => null),
    loadImage(input.garmentMaskBytes).catch(() => null),
  ]);
  if (!decoded || !mask) throw new Error("NORMAL_DECODE_FAILED");
  if (decoded.width !== input.result.outputWidth || decoded.height !== input.result.outputHeight || decoded.width < 16 || decoded.height < 16 || mask.width !== input.sourceWidth || mask.height !== input.sourceHeight) throw new Error("NORMAL_DIMENSIONS_INVALID");

  const canvas = createCanvas(input.sourceWidth, input.sourceHeight);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.drawImage(decoded, 0, 0, input.sourceWidth, input.sourceHeight);
  const pixels = context.getImageData(0, 0, input.sourceWidth, input.sourceHeight);
  const maskCanvas = createCanvas(input.sourceWidth, input.sourceHeight);
  const maskContext = maskCanvas.getContext("2d");
  maskContext.imageSmoothingEnabled = false;
  maskContext.drawImage(mask, 0, 0, input.sourceWidth, input.sourceHeight);
  const maskPixels = maskContext.getImageData(0, 0, input.sourceWidth, input.sourceHeight).data;

  const samples: Array<{ x: number; y: number; z: number }> = [];
  const step = Math.max(1, Math.floor(Math.max(input.sourceWidth, input.sourceHeight) / 384));
  for (let y = 0; y < input.sourceHeight; y += step) {
    for (let x = 0; x < input.sourceWidth; x += step) {
      const offset = (y * input.sourceWidth + x) * 4;
      const maskLuma = maskPixels[offset]! * 0.2126 + maskPixels[offset + 1]! * 0.7152 + maskPixels[offset + 2]! * 0.0722;
      if (maskPixels[offset + 3]! < 128 || maskLuma < 128) continue;
      const vector = decodeNormal(pixels.data[offset]!, pixels.data[offset + 1]!, pixels.data[offset + 2]!);
      if (vector) samples.push(vector);
    }
  }
  if (samples.length < input.policy.minimumUsableSamples) throw new Error("NORMAL_SAMPLES_INSUFFICIENT");
  const initial = { x: median(samples.map((sample) => sample.x)), y: median(samples.map((sample) => sample.y)), z: median(samples.map((sample) => sample.z)) };
  const initialLength = Math.hypot(initial.x, initial.y, initial.z);
  if (initialLength < 0.1) throw new Error("NORMAL_FIELD_DEGENERATE");
  const unit = { x: initial.x / initialLength, y: initial.y / initialLength, z: initial.z / initialLength };
  const angular = samples.map((sample) => Math.acos(clamp(sample.x * unit.x + sample.y * unit.y + sample.z * unit.z, -1, 1)));
  const medAngular = median(angular);
  const mad = median(angular.map((value) => Math.abs(value - medAngular)));
  const limit = medAngular + Math.max(0.08, mad * 3.5);
  const kept = samples.filter((_sample, index) => angular[index]! <= limit);
  if (kept.length < input.policy.minimumUsableSamples) throw new Error("NORMAL_SAMPLES_INSUFFICIENT");
  const medianRaw = { x: median(kept.map((sample) => sample.x)), y: median(kept.map((sample) => sample.y)), z: median(kept.map((sample) => sample.z)) };
  const length = Math.hypot(medianRaw.x, medianRaw.y, medianRaw.z);
  if (length < 0.1) throw new Error("NORMAL_FIELD_DEGENERATE");
  const medianNormal = { x: medianRaw.x / length, y: medianRaw.y / length, z: medianRaw.z / length };
  const dots = kept.map((sample) => clamp(sample.x * medianNormal.x + sample.y * medianNormal.y + sample.z * medianNormal.z, -1, 1));
  const fieldConsistency = clamp(median(dots));
  const componentSpread = ["x", "y", "z"].map((key) => {
    const values = kept.map((sample) => sample[key as keyof typeof sample]);
    const med = median(values);
    return median(values.map((value) => Math.abs(value - med)));
  });
  const directionalVariation = clamp(Math.hypot(...componentSpread) * 4);
  if (fieldConsistency < input.policy.minimumFieldConsistency || directionalVariation < 0.002) throw new Error("NORMAL_FIELD_UNSTABLE");

  // Persist the exact vector pixels normalized only to Base dimensions.
  const normalizedNormalMapPngBytes = canvas.toBuffer("image/png");
  const normalMapChecksumSha256 = sha256(normalizedNormalMapPngBytes);
  const provenance = normalEstimationProvenanceSchema.parse({
    contractVersion: MIDAS_NORMAL_CONTRACT_VERSION,
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
    providerOutputDimensions: { width: input.result.outputWidth, height: input.result.outputHeight },
    normalizedDimensions: { width: input.sourceWidth, height: input.sourceHeight },
    normalMapChecksumSha256,
    validation: { decoding: "RGB_SIGNED_UNIT_VECTOR_X_RIGHT_Y_UP_Z_CAMERA", usableGarmentSamples: kept.length, rejectedOutliers: samples.length - kept.length, medianNormal, fieldConsistency, directionalVariation },
    artworkInputIncluded: false,
    depthOutputPersisted: false,
  });
  return { provenance: provenance as ValidatedNormalEstimation["provenance"], normalizedNormalMapPngBytes };
}

export function rejectedNormalProvenance(input: { policy: NormalEstimationPolicy; jobId: string; sourceBaseChecksumSha256: string; sourceWidth: number; sourceHeight: number; idempotencyKey: string; reason: Exclude<import("@/lib/image/normal-estimation/types").NormalEstimationProvenance["validationReason"], "ACCEPTED">; status?: "REJECTED" | "MISSING" | "UNKNOWN_OUTCOME"; providerRequestId?: string | null }) {
  return normalEstimationProvenanceSchema.parse({
    contractVersion: MIDAS_NORMAL_CONTRACT_VERSION, policy: input.policy,
    status: input.status ?? "REJECTED", validationReason: input.reason,
    provider: input.policy.provider, model: input.policy.model, adapterVersion: input.policy.adapterVersion,
    providerRequestId: input.providerRequestId ?? null, jobId: input.jobId,
    sourceBaseChecksumSha256: input.sourceBaseChecksumSha256, idempotencyKeyHash: sha256(input.idempotencyKey),
    sourceDimensions: { width: input.sourceWidth, height: input.sourceHeight }, providerOutputDimensions: null,
    normalizedDimensions: null, normalMapChecksumSha256: null, validation: null,
    artworkInputIncluded: false, depthOutputPersisted: false,
  });
}
