/**
 * NexHQ Brain — central context and memory layer.
 *
 * Single source of truth for all NexHQ workspaces.
 * Implementation (Supabase, vector store, client) is deferred — this
 * module exports the type system and contracts only.
 */

// Core
export type {
  BrainActor,
  BrainActorType,
  BrainDomain,
  BrainEmbeddingMeta,
  BrainProvenance,
  BrainReadOptions,
  BrainRecord,
  BrainRecordForDomain,
  BrainRecordStatus,
  BrainRelation,
  BrainRelationType,
  BrainSearchResult,
  BrainSemanticQuery,
  BrainUpdateInput,
  BrainWriteInput,
  CoreBrainDomain,
  IndustryBrainDomain,
  DomainTier,
  IsCoreDomain,
  IsIndustryDomain,
} from "./types";

export {
  BRAIN_DEFAULT_EMBEDDING_DIMENSIONS,
  BRAIN_DEFAULT_EMBEDDING_MODEL,
  BRAIN_DOMAIN_REGISTRY,
  BRAIN_DOMAINS,
  BRAIN_SCHEMA_VERSION,
} from "./constants";

export type { BrainDomainMeta, BrainWriterId } from "./constants";

// Registry
export type { BrainDomainDefinition } from "./registry";
export {
  BRAIN_ALL_DOMAINS,
  BRAIN_CORE_DOMAINS,
  BRAIN_INDUSTRY_DOMAINS,
} from "./registry";

// Workspaces
export type { WorkspaceDefinition, WorkspaceSeedRecord } from "./workspaces";
export {
  getWorkspaceConfig,
  listWorkspaces,
  WORKSPACE_REGISTRY,
} from "./workspaces";

// Platform (HQ OS)
export type {
  BrainWorkspace,
  BrainWorkspaceConfig,
  BrainWorkspaceProvisionInput,
  HqIndustryId,
  HqIndustryPack,
  HqModuleDefinition,
  HqModuleId,
  IndustryDomainMap,
  WorkspaceDomainForIndustry,
} from "./platform";

export {
  HQ_INDUSTRY_IDS,
  HQ_INDUSTRY_PACKS,
  HQ_MODULE_IDS,
  HQ_MODULE_REGISTRY,
} from "./platform";

// Domains
export type {
  AgencyCampaignDeliverable,
  AgencyCampaignStatus,
  AudienceMemoryContent,
  AudiencePlatform,
  AudienceSegment,
  AudienceSegmentProfile,
  BrandPillar,
  BrandRule,
  BrandRuleSeverity,
  BrandRulesContent,
  BrandVisionContent,
  BrainDomainContent,
  BrainDomainContentMap,
  BrainReportContent,
  BrainTaskContent,
  CampaignKpi,
  CampaignMemoryContent,
  CampaignStatus,
  CatalogItemStatus,
  CatalogMemoryContent,
  CatalogVariant,
  ChannelMixEntry,
  ClientContact,
  ClientMemoryContent,
  ClientStatus,
  ColorSwatch,
  CompanyIntegration,
  CompanyIntegrationStatus,
  CompanyKpi,
  CompanyProfileContent,
  CompetitorIntelligenceContent,
  CompetitorProfile,
  CompetitorTier,
  ContentBlock,
  ContentChannel,
  ContentFormat,
  ContentMemoryContent,
  CustomerHealth,
  CustomerMemoryContent,
  CustomerSegment,
  CustomerTier,
  DecisionAlternative,
  DecisionContent,
  DecisionStatus,
  DesignAssetRef,
  DesignMemoryContent,
  DropInfo,
  MarketSignal,
  MarketingMemoryContent,
  ProductMemoryContent,
  ProductRoadmapContent,
  ProductSku,
  ProductStatus,
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapPriority,
  StorefrontMemoryContent,
  StorefrontPage,
  StorefrontPageType,
  TypographySpec,
} from "./domains";

export { isBrainContentForDomain } from "./domains";

// Interfaces
export type {
  BrainClient,
  BrainClientFactory,
  BrainIntegrationDefinition,
  BrainIntegrationHook,
  BrainReadResult,
  BrainVectorStore,
  BrainVectorStoreFactory,
  BrainWriteResult,
  EmbedOptions,
  EmbeddingInput,
  IntegrationDirection,
  IntegrationId,
  IntegrationSyncResult,
  VectorUpsertInput,
} from "./interfaces";

export { BRAIN_INTEGRATION_REGISTRY } from "./interfaces";

// Context
export type {
  BrainAgentContext,
  BrainContextAssembler,
  BrainContextAssemblerFactory,
  BrainContextRequest,
  BrainContextSlice,
  BrainGraphConfig,
  BrainGraphState,
  BrainGraphStateUpdate,
  BrainPendingWrite,
  BrainQueryLogEntry,
} from "./context";

// Events
export type {
  BrainContextAssembledEvent,
  BrainEvent,
  BrainEventBase,
  BrainEventBus,
  BrainEventFilter,
  BrainEventType,
  BrainIntegrationSyncedEvent,
  BrainRecordCreatedEvent,
  BrainRecordUpdatedEvent,
  BrainSearchPerformedEvent,
} from "./events";

// Schema (Supabase preparation)
export type {
  BrainDatabase,
  BrainEmbeddingsInsert,
  BrainEmbeddingsRow,
  BrainEventsInsert,
  BrainEventsRow,
  BrainRecordsInsert,
  BrainRecordsRow,
  BrainRecordsUpdate,
  BrainWorkspacesInsert,
  BrainWorkspacesRow,
  BrainWorkspacesUpdate,
  Json,
} from "./schema";
