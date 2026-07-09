/**
 * Content Agent — publish-ready copy grounded in Brain intelligence.
 */

export { runContent, ContentKnowledgeError } from "./run";
export { parseContentOutput, ContentParseError } from "./parse-output";
export { enrichContentPayload } from "./enrich-output";
export { saveContentToBrain } from "./save";
export { retrieveContentKnowledge } from "./retrieve-context";
export {
  publishToShopify,
  publishToKlaviyo,
  publishToInstagram,
} from "./operations";
export type {
  ContentRunInput,
  ContentRunResult,
  ContentOutput,
  ContentLandingPageCopy,
  ContentProductCopy,
  ContentEmailSequence,
  ContentSocialContent,
  ContentSmsCampaign,
} from "./types";
