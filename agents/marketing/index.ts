/**
 * Marketing Agent — campaign planning grounded in Brain intelligence.
 */

export { runMarketing, MarketingKnowledgeError } from "./run";
export { parseMarketingOutput, MarketingParseError } from "./parse-output";
export { enrichMarketingPayload } from "./enrich-output";
export { saveMarketingToBrain } from "./save";
export { retrieveMarketingKnowledge } from "./retrieve-context";
export type { MarketingRunInput, MarketingRunResult, MarketingOutput } from "./types";
