/**
 * Face-similarity threshold calibration utility.
 *
 * Use this to measure actual euclidean distances between image pairs so you
 * can calibrate the duplicate/warning thresholds with real production data.
 *
 * NO paid provider calls.  Runs fully local.
 *
 * Usage (server-side script only):
 *
 *   const report = await runCalibration([
 *     { labelA: "PersonA_crop", pathA: "/tmp/a1.jpg", labelB: "PersonA_resize", pathB: "/tmp/a2.jpg", expectDuplicate: true },
 *     { labelA: "PersonA",      pathA: "/tmp/a1.jpg", labelB: "PersonB",        pathB: "/tmp/b1.jpg", expectDuplicate: false },
 *   ]);
 *   console.log(JSON.stringify(report, null, 2));
 */

import { extractFaceEmbedding } from "./local-face-embedding-evaluator";
import {
  euclideanDistance,
  euclideanToCosineSimilarity,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
} from "./similarity-threshold";

export interface CalibrationPair {
  labelA: string;
  pathA: string;
  labelB: string;
  pathB: string;
  /** Ground truth: are these the same identity? */
  expectDuplicate: boolean;
}

export interface CalibrationPairResult {
  labelA: string;
  labelB: string;
  euclideanDistance?: number;
  cosineSimilarity?: number;
  predictedDuplicate?: boolean;
  predictedWarning?: boolean;
  correct?: boolean;
  expectDuplicate: boolean;
  statusA: string;
  statusB: string;
  error?: string;
}

export interface CalibrationReport {
  testedAt: string;
  duplicateThreshold: number;
  warningThreshold: number;
  pairResults: CalibrationPairResult[];
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision?: number;
  recall?: number;
  /** Human-readable summary. */
  summary: string;
}

export async function runCalibration(pairs: CalibrationPair[]): Promise<CalibrationReport> {
  const pairResults: CalibrationPairResult[] = [];

  for (const pair of pairs) {
    const result: CalibrationPairResult = {
      labelA: pair.labelA,
      labelB: pair.labelB,
      expectDuplicate: pair.expectDuplicate,
      statusA: "pending",
      statusB: "pending",
    };

    try {
      const [extractA, extractB] = await Promise.all([
        extractFaceEmbedding(pair.pathA),
        extractFaceEmbedding(pair.pathB),
      ]);

      result.statusA = extractA.status;
      result.statusB = extractB.status;

      if (extractA.status !== "performed" || extractB.status !== "performed") {
        result.error = `Detection failed: A=${extractA.status} B=${extractB.status}`;
      } else {
        const dist = euclideanDistance(extractA.embedding!, extractB.embedding!);
        result.euclideanDistance = dist;
        result.cosineSimilarity = euclideanToCosineSimilarity(dist);
        result.predictedDuplicate = dist <= FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD;
        result.predictedWarning =
          !result.predictedDuplicate && dist <= FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD;
        result.correct = result.predictedDuplicate === pair.expectDuplicate;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    pairResults.push(result);
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of pairResults) {
    if (r.predictedDuplicate === undefined) continue;
    if (r.expectDuplicate && r.predictedDuplicate) tp++;
    else if (!r.expectDuplicate && r.predictedDuplicate) fp++;
    else if (!r.expectDuplicate && !r.predictedDuplicate) tn++;
    else fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : undefined;
  const recall = tp + fn > 0 ? tp / (tp + fn) : undefined;

  const summary = [
    `Calibration: ${pairs.length} pairs tested`,
    `TP=${tp} FP=${fp} TN=${tn} FN=${fn}`,
    precision !== undefined ? `Precision=${precision.toFixed(3)}` : "Precision=N/A",
    recall !== undefined ? `Recall=${recall.toFixed(3)}` : "Recall=N/A",
    `thresholds: dup≤${FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD} warn≤${FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD}`,
  ].join(" | ");

  return {
    testedAt: new Date().toISOString(),
    duplicateThreshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    warningThreshold: FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    pairResults,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision,
    recall,
    summary,
  };
}
