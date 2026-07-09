/**
 * Agent layer — hierarchical multi-agent system.
 * CEO Agent orchestrates; specialists report back.
 */

export type { Agent, AgentContext, AgentResult } from "./types";

export {
  runContent,
  ContentKnowledgeError,
  parseContentOutput,
  ContentParseError,
  saveContentToBrain,
  retrieveContentKnowledge,
} from "./content";
export type {
  ContentRunInput,
  ContentRunResult,
  ContentOutput,
} from "./content";

export {
  runImage,
  ImageKnowledgeError,
  parseImageOutput,
  ImageParseError,
  saveImageToBrain,
  retrieveImageKnowledge,
} from "./image";
export type {
  ImageRunInput,
  ImageRunResult,
  ImageOutput,
} from "./image";
