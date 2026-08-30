import { createCanvas, loadImage } from "canvas";
import { NORMAL_ASSISTED_TORSO_VERSION, normalOrientationEvidenceSchema, type NormalOrientationEvidence } from "@/lib/image/normal-estimation/types";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? 0; }
function decode(r: number, g: number, b: number) {
  const v = { x: r / 127.5 - 1, y: 1 - g / 127.5, z: b / 127.5 - 1 };
  const length = Math.hypot(v.x, v.y, v.z);
  return length > 1e-6 ? { x: v.x / length, y: v.y / length, z: v.z / length } : null;
}

/**
 * Derives image-plane surface direction from the low-frequency structure
 * tensor of a decoded normal field. RGB is decoded to X-right/Y-up/Z-camera;
 * raster gradients use image Y-down. Only samples accepted by the caller's
 * SAM ∩ torso-safe-polygon ∩ print-neighbourhood predicate participate.
 */
export async function analyzeGarmentNormalOrientation(input: {
  normalMapBytes: Buffer;
  imageWidth: number;
  imageHeight: number;
  contains: (x: number, y: number) => boolean;
  minimumSamples?: number;
}): Promise<NormalOrientationEvidence> {
  const image = await loadImage(input.normalMapBytes).catch(() => null);
  if (!image) return refused("NORMAL_EVIDENCE_INSUFFICIENT");
  const width = Math.min(384, input.imageWidth);
  const height = Math.max(32, Math.round(input.imageHeight * width / input.imageWidth));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const at = (x: number, y: number) => decode(pixels[(y * width + x) * 4]!, pixels[(y * width + x) * 4 + 1]!, pixels[(y * width + x) * 4 + 2]!);
  const samples: Array<{ vector: { x: number; y: number; z: number }; gx2: number; gxy: number; gy2: number }> = [];
  for (let y = 2; y < height - 2; y += 2) for (let x = 2; x < width - 2; x += 2) {
    const nx = x / width, ny = y / height;
    if (!input.contains(nx, ny)) continue;
    const center = at(x, y), left = at(x - 2, y), right = at(x + 2, y), top = at(x, y - 2), bottom = at(x, y + 2);
    if (!center || !left || !right || !top || !bottom) continue;
    const dx = { x: right.x - left.x, y: right.y - left.y, z: right.z - left.z };
    const dy = { x: bottom.x - top.x, y: bottom.y - top.y, z: bottom.z - top.z };
    samples.push({
      vector: center,
      gx2: dx.x * dx.x + dx.y * dx.y + dx.z * dx.z,
      gxy: dx.x * dy.x + dx.y * dy.y + dx.z * dy.z,
      gy2: dy.x * dy.x + dy.y * dy.y + dy.z * dy.z,
    });
  }
  const minimum = input.minimumSamples ?? 80;
  if (samples.length < minimum) return refused("NORMAL_EVIDENCE_INSUFFICIENT", samples.length);
  const gradientMagnitude = samples.map((sample) => Math.sqrt(Math.max(0, sample.gx2 + sample.gy2)));
  const med = median(gradientMagnitude);
  const mad = median(gradientMagnitude.map((value) => Math.abs(value - med)));
  const kept = samples.filter((_sample, index) => gradientMagnitude[index]! <= med + Math.max(0.04, mad * 4));
  if (kept.length < minimum) return refused("NORMAL_FIELD_UNSTABLE", kept.length, samples.length - kept.length);
  const rawMedian = { x: median(kept.map((s) => s.vector.x)), y: median(kept.map((s) => s.vector.y)), z: median(kept.map((s) => s.vector.z)) };
  const length = Math.hypot(rawMedian.x, rawMedian.y, rawMedian.z);
  if (length < 0.1) return refused("NORMAL_FIELD_UNSTABLE", kept.length, samples.length - kept.length);
  const medianNormal = { x: rawMedian.x / length, y: rawMedian.y / length, z: rawMedian.z / length };
  const consistency = clamp(median(kept.map((s) => s.vector.x * medianNormal.x + s.vector.y * medianNormal.y + s.vector.z * medianNormal.z)));
  // The direction with lower normal-field change is the garment's coherent
  // vertical fall direction. atan2(dx, dy) produces signed rotation from the
  // image vertical without treating the background as evidence.
  let xx = 0, xy = 0, yy = 0;
  for (const sample of kept) { xx += sample.gx2; xy += sample.gxy; yy += sample.gy2; }
  xx /= kept.length; xy /= kept.length; yy /= kept.length;
  const trace = xx + yy;
  const root = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy ** 2));
  const lambdaLow = (trace - root) / 2, lambdaHigh = (trace + root) / 2;
  let vx = -xy, vy = xx - lambdaLow;
  if (Math.hypot(vx, vy) < 1e-8) { vx = 0; vy = 1; }
  if (vy < 0) { vx = -vx; vy = -vy; }
  const orientationDegrees = clamp(Math.atan2(vx, vy) * 180 / Math.PI, -20, 20);
  const anisotropy = clamp((lambdaHigh - lambdaLow) / Math.max(1e-8, lambdaHigh + lambdaLow));
  const sampleConfidence = clamp(kept.length / 420);
  const confidence = clamp(consistency * 0.45 + anisotropy * 0.4 + sampleConfidence * 0.15);
  if (confidence < 0.5 || !Number.isFinite(orientationDegrees)) return refused("NORMAL_FIELD_UNSTABLE", kept.length, samples.length - kept.length, medianNormal, consistency, anisotropy);
  return normalOrientationEvidenceSchema.parse({ contractVersion: NORMAL_ASSISTED_TORSO_VERSION, status: "READY", reason: "READY", orientationDegrees, confidence, usableSamples: kept.length, rejectedOutliers: samples.length - kept.length, medianNormal, fieldConsistency: consistency, directionalAnisotropy: anisotropy, backgroundEvidenceExcluded: true, sleevesExcluded: true, collarTransitionExcluded: true, coordinateConvention: "IMAGE_X_RIGHT_IMAGE_Y_DOWN_NORMAL_Y_UP" });
}

function refused(reason: "NORMAL_EVIDENCE_INSUFFICIENT" | "NORMAL_FIELD_UNSTABLE", usableSamples = 0, rejectedOutliers = 0, medianNormal = { x: 0, y: 0, z: 1 }, fieldConsistency = 0, directionalAnisotropy = 0): NormalOrientationEvidence {
  return normalOrientationEvidenceSchema.parse({ contractVersion: NORMAL_ASSISTED_TORSO_VERSION, status: "REFUSED", reason, orientationDegrees: 0, confidence: 0, usableSamples, rejectedOutliers, medianNormal, fieldConsistency, directionalAnisotropy, backgroundEvidenceExcluded: true, sleevesExcluded: true, collarTransitionExcluded: true, coordinateConvention: "IMAGE_X_RIGHT_IMAGE_Y_DOWN_NORMAL_Y_UP" });
}

export type NormalSilhouetteRelationship = "AGREES" | "PARTIAL_AGREEMENT" | "NORMAL_RESCUES_SILHOUETTE" | "SILHOUETTE_RESCUES_NORMAL" | "CONTRADICTORY" | "INSUFFICIENT";
export function combineNormalAndSilhouette(input: { silhouetteDegrees: number; silhouetteConfidence: number; normal: NormalOrientationEvidence }) {
  const normalConfidence = input.normal.status === "READY" ? input.normal.confidence : 0;
  const delta = Math.abs(input.silhouetteDegrees - input.normal.orientationDegrees);
  const silhouetteStrong = input.silhouetteConfidence >= 0.55;
  const normalStrong = normalConfidence >= 0.55;
  let relationship: NormalSilhouetteRelationship;
  if (silhouetteStrong && normalStrong && delta > 7) relationship = "CONTRADICTORY";
  else if (!silhouetteStrong && normalStrong) relationship = "NORMAL_RESCUES_SILHOUETTE";
  else if (silhouetteStrong && !normalStrong) relationship = "SILHOUETTE_RESCUES_NORMAL";
  else if (!silhouetteStrong && !normalStrong) relationship = "INSUFFICIENT";
  else if (delta <= 2.5) relationship = "AGREES";
  else relationship = "PARTIAL_AGREEMENT";
  const s2 = input.silhouetteConfidence ** 2, n2 = normalConfidence ** 2;
  const total = Math.max(1e-9, s2 + n2);
  const silhouetteWeight = s2 / total, normalWeight = n2 / total;
  const finalDegrees = relationship === "SILHOUETTE_RESCUES_NORMAL" ? input.silhouetteDegrees : relationship === "NORMAL_RESCUES_SILHOUETTE" ? input.normal.orientationDegrees : input.silhouetteDegrees * silhouetteWeight + input.normal.orientationDegrees * normalWeight;
  const agreementFactor = relationship === "AGREES" ? 1.1 : relationship === "PARTIAL_AGREEMENT" ? 0.92 : 1;
  const finalConfidence = clamp(Math.max(input.silhouetteConfidence, normalConfidence) * agreementFactor);
  return { relationship, silhouetteWeight, normalWeight, finalDegrees, finalConfidence, deltaDegrees: delta };
}
