/**
 * Paid generation confirmation helpers — estimate hash + tokens.
 * No secrets stored.
 */

import { createHash, randomUUID } from "node:crypto";
import type {
  CandidateGenerationCostEstimate,
  GenerationStage,
  QualityMode,
} from "../domain/creation-types";

export function buildEstimateHash(input: {
  projectId: string;
  stage: GenerationStage;
  qualityMode: QualityMode;
  candidateCount: number;
  assetCount: number;
  estimatedMin: number;
  estimatedMax: number;
}): string {
  const raw = [
    input.projectId,
    input.stage,
    input.qualityMode,
    String(input.candidateCount),
    String(input.assetCount),
    input.estimatedMin.toFixed(4),
    input.estimatedMax.toFixed(4),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export function createConfirmationToken(): string {
  return `pct_${randomUUID().replace(/-/g, "")}`;
}

export function estimateFingerprintFromCost(
  projectId: string,
  qualityMode: QualityMode,
  estimate: CandidateGenerationCostEstimate,
): string {
  return buildEstimateHash({
    projectId,
    stage: estimate.stage,
    qualityMode,
    candidateCount: estimate.candidateCount,
    assetCount: estimate.totalImages,
    estimatedMin: estimate.estimatedMin,
    estimatedMax: estimate.estimatedMax,
  });
}
