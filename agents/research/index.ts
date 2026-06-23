/**
 * Research Agent — market intelligence and structured reporting.
 * MVP: generate reports via OpenAI and persist to workspace Brain.
 */

export { runResearch } from "./run";
export { parseResearchOutput, ResearchParseError, isDesignResearchPayload } from "./parse-output";
export { saveResearchToBrain } from "./save";
export { retrieveResearchKnowledge } from "./retrieve-context";
export type {
  ResearchRunInput,
  ResearchRunResult,
  ResearchDesignBriefOutput,
  ResearchOutput,
  DesignResearchOutput,
  DesignConcept,
  CreativeApproach,
  ParsedResearchOutput,
  ResearchType,
} from "./types";
export { CREATIVE_APPROACHES, PRODUCTION_DIFFICULTY_LEVELS, colorBreakdownEntrySchema } from "./types";
export type { ColorBreakdownEntry } from "./types";
export {
  coerceConceptField,
  normalizeDesignConcept,
  normalizeDesignConcepts,
  diversifyDesignConcepts,
  normalizeCreativeApproach,
  summarizeDesignConcept,
  summarizeDesignConcepts,
  formatDesignConceptMarkdown,
  formatColorBreakdown,
  visualConceptFingerprint,
} from "./design-concept";
