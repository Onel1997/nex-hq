/**
 * CEO Agent — master orchestrator.
 * Phase 1: advisory chat mode (read Brain → respond).
 * Phase 2: strategic briefing with knowledge-grounded reports.
 */

export { runCeoChat } from "./chat";
export type { CeoChatInput, CeoChatOutput } from "./chat";

export { runCeo, CeoKnowledgeError, CeoParseError } from "./run";
export type { CeoRunInput, CeoRunResult } from "./types";
