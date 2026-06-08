/**
 * Research Agent — market intelligence and structured reporting.
 * MVP: generate reports via OpenAI and persist to workspace Brain.
 */

export { runResearch } from "./run";
export { parseResearchOutput, ResearchParseError } from "./parse-output";
export { saveResearchToBrain } from "./save";
export type { ResearchRunInput, ResearchRunResult } from "./types";
export type { ResearchOutput, ResearchType } from "./types";
