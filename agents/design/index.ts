/**
 * Design Agent — collection concept generation grounded in Brain intelligence.
 */

export { runDesign, DesignKnowledgeError } from "./run";
export { parseDesignOutput, DesignParseError } from "./parse-output";
export { enrichDesignPayload } from "./enrich-output";
export { saveDesignToBrain } from "./save";
export { retrieveDesignKnowledge } from "./retrieve-context";
export type { DesignRunInput, DesignRunResult, DesignOutput } from "./types";
