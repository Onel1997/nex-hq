/**
 * Design Agent — collection concept generation grounded in Brain intelligence.
 */

export { runDesign, DesignKnowledgeError } from "./run";
export { parseDesignOutput, DesignParseError } from "./parse-output";
export { enrichDesignPayload } from "./enrich-output";
export { saveDesignToBrain } from "./save";
export { retrieveDesignKnowledge } from "./retrieve-context";
export {
  handoffResearchToDesignStudio,
  convertResearchConceptToStudioBrief,
  ResearchHandoffError,
} from "./research-handoff";
export { loadResearchDesignReport } from "./load-research-design";
export { loadResearchDirectionContext } from "./load-research-context";
export {
  generateDesignDirectionsFromResearch,
  regenerateDesignDirectionFromResearch,
} from "./generate-directions";
export { parseGeneratedDirections, DesignDirectionsParseError } from "./parse-directions";
export type { DesignRunInput, DesignRunResult, DesignOutput } from "./types";
export type {
  DesignStudioBrief,
  DesignStudioColor,
  ResearchHandoffResult,
} from "./studio-brief";
