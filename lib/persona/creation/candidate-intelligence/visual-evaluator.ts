/**
 * Optional vision-based casting evaluation — architecture only.
 * Default: DISABLED. No live model calls in this phase.
 */

export const PERSONA_VISUAL_EVALUATION_ENABLED_ENV =
  "PERSONA_VISUAL_EVALUATION_ENABLED" as const;

export function isPersonaVisualEvaluationEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env[PERSONA_VISUAL_EVALUATION_ENABLED_ENV] === "true";
}

export type VisualEvaluationStatus =
  | "not_performed"
  | "pending"
  | "completed"
  | "failed"
  | "disabled";

export interface VisualCastingDimensions {
  commercialFace: number;
  approachability: number;
  expressionSoftness: number;
  authenticity: number;
  streetwearCredibility: number;
  brandMemorability: number;
  ageFit: number;
  imageQuality: number;
  identityConsistencyAcrossAngles: number;
  visibleArtifactRisk: number;
  overall: number;
}

export interface VisualCastingEvaluation {
  status: VisualEvaluationStatus;
  method: "none" | "fake_vision_v1" | "vision_model_v1";
  dimensions: VisualCastingDimensions | null;
  summary: string;
  evaluatedAt: string | null;
  costLabel: "not_applicable" | "estimated" | "requires_consent";
}

export interface PersonaVisualEvaluatorInput {
  candidateId: string;
  candidateNumber: number;
  imageUrls: string[];
  assetTypes: string[];
}

export interface PersonaVisualEvaluator {
  evaluateCandidate(
    input: PersonaVisualEvaluatorInput,
  ): Promise<VisualCastingEvaluation>;
}

export function emptyVisualEvaluation(
  status: VisualEvaluationStatus = "not_performed",
): VisualCastingEvaluation {
  return {
    status,
    method: "none",
    dimensions: null,
    summary:
      status === "disabled"
        ? "Visual evaluation disabled (PERSONA_VISUAL_EVALUATION_ENABLED=false)."
        : "Not visually evaluated — no image-capable evaluator has analyzed this candidate.",
    evaluatedAt: null,
    costLabel: "not_applicable",
  };
}

/** Fake evaluator for tests — never calls a live model. */
export class FakePersonaVisualEvaluator implements PersonaVisualEvaluator {
  async evaluateCandidate(
    input: PersonaVisualEvaluatorInput,
  ): Promise<VisualCastingEvaluation> {
    const base = 62 + (input.candidateNumber % 4) * 5;
    const dimensions: VisualCastingDimensions = {
      commercialFace: base,
      approachability: base + 4,
      expressionSoftness: base + 2,
      authenticity: base + 3,
      streetwearCredibility: base + 1,
      brandMemorability: base - 2,
      ageFit: base + 2,
      imageQuality: base,
      identityConsistencyAcrossAngles: input.imageUrls.length >= 2 ? base : 40,
      visibleArtifactRisk: Math.max(10, 40 - input.imageUrls.length * 5),
      overall: base,
    };
    return {
      status: "completed",
      method: "fake_vision_v1",
      dimensions,
      summary: `Fake visual evaluation for candidate ${input.candidateNumber} (${input.imageUrls.length} images).`,
      evaluatedAt: new Date().toISOString(),
      costLabel: "estimated",
    };
  }
}

export function resolvePersonaVisualEvaluator(
  env: NodeJS.ProcessEnv = process.env,
): PersonaVisualEvaluator | null {
  if (!isPersonaVisualEvaluationEnabled(env)) return null;
  // Live vision adapters are intentionally not wired in this phase.
  return new FakePersonaVisualEvaluator();
}
