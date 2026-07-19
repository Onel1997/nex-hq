import "server-only";

import { buildResearchCreativeBrief } from "./builder";
import type { CreativeBriefEngineInput, CreativeBriefEngineResult } from "./types";

/**
 * Deterministic Creative Brief layer — runs after Brand Intelligence.
 * Produces a design strategy document only. No artwork or image generation.
 */
export function runCreativeBriefEngine(
  input: CreativeBriefEngineInput,
): CreativeBriefEngineResult {
  const generatedAt = input.generatedAt ?? input.brandIntelligence.generatedAt;
  const approvedCount = input.brandIntelligence.topOpportunities.length;

  if (approvedCount === 0 || input.brandIntelligence.brandFitScore < 40) {
    return { creativeBrief: null };
  }

  const creativeBrief = buildResearchCreativeBrief({
    intelligence: input.intelligence,
    reasoning: input.reasoning,
    brandIntelligence: input.brandIntelligence,
    patternIntelligence: input.patternIntelligence,
    generatedAt,
    userRequest: input.userRequest,
  });

  return { creativeBrief };
}
