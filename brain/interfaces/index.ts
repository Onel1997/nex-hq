export type {
  BrainClient,
  BrainClientFactory,
  BrainReadResult,
  BrainWriteResult,
} from "./client";

export type {
  BrainVectorStore,
  BrainVectorStoreFactory,
  EmbedOptions,
  EmbeddingInput,
  VectorUpsertInput,
} from "./vector";

export type {
  BrainIntegrationDefinition,
  BrainIntegrationHook,
  IntegrationDirection,
  IntegrationId,
  IntegrationSyncResult,
} from "./integrations";

export { BRAIN_INTEGRATION_REGISTRY } from "./integrations";
