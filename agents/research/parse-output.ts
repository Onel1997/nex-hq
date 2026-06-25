import { z } from "zod";
import { enrichResearchPayload } from "./enrich-output";
import {
  coerceConceptField,
  finalizeDesignConceptsForValidation,
  normalizeDesignConcepts,
} from "./design-concept";
import {
  compactDesignConceptsForDetailMode,
  DEFAULT_RESEARCH_DETAIL_MODE,
  type ResearchDetailMode,
} from "./detail-mode";
import { MILAENE_BRAND_DNA } from "./brand-dna";
import { applyCollectionPipeline } from "./collection-pipeline";
import {
  applyFinalConsistencyToDesignOutput,
  assertFinalCollectionConsistency,
  logFinalPipelineCrash,
  pipelineStepSnapshot,
} from "./final-consistency-pass";
import { coercePercentScore, coerceRetailPrice, coerceCampaignPotential, coerceRepeatabilityScore } from "./score-coercion";
import { assertCompleteJsonResponse } from "./response-guard";
import {
  designResearchOutputSchema,
  researchOutputSchema,
  COLLECTION_ROLES,
  type CollectionRole,
  type CreativeApproach,
  type DesignResearchOutput,
  type ParsedResearchOutput,
  type RelationshipGraphNode,
  type ResearchOutput,
} from "./types";

export const EXPECTED_RESEARCH_SCHEMA = {
  title: "string (required; fallback from trendReport.headline, designBrief.collectionIdea, or 'Research Report')",
  executiveSummary: "string (required, min 80 chars)",
  reportType: "competitor | trend | design | pricing | audience (required)",
  keyFindings: "string[] (required, 5–12 detailed items)",
  opportunities: "string[] (required, 3–10 items)",
  risks: "string[] (required, 3–8 items)",
  recommendations: "string[] (required, 4–10 items)",
  confidence: "number 0–1 (required)",
  fullAnalysis: "string (required, min 800 chars, Markdown)",
  competitorReport: "auto-generated or filled when reportType=competitor",
  trendReport: "auto-generated or filled when reportType=trend",
  competitorIntelligence: "optional { competitors, competitiveEdge, ... }",
  marketingMemory: "optional { name, objective, notes, ... }",
  designMemory: "optional { silhouettes, moodKeywords, ... }",
  connectorIntelligence:
    "optional { scores: { socialScore, demandScore, trendScore, confidence }, connectors, mode }",
  designBrief:
    "auto-generated server-side — collectionIdea, scores, connectorScores, intelligenceMode",
} as const;

export const EXPECTED_DESIGN_RESEARCH_SCHEMA = {
  title: "string (required)",
  designs:
    "DesignConcept[] (required, 5–8 connected concepts in one capsule; designId, supportsDesignId, collectionRole; brand-DNA + visual-DNA fields; concepts below 65% DNA fit rejected server-side)",
  collection:
    "ResearchCollection (optional in LLM output — server builds: name, type, story, mood, philosophy, heroDesignId, supportingDesignIds[], colorDirection[], targetAudience, dropStrategy, collectionScore, ceoRecommendation, collectionImagePrompt, campaignTheme, heroProduct)",
  brandDNA:
    "BrandDna object (optional — server attaches Milaene core DNA: philosophy, forbiddenStyles, preferredSilhouettes, preferredPlacements, signatureElements, emotionalGoals, materialLanguage, typographyRules)",
  products: "string[] (optional — real catalog products only)",
  colors: "string[] (optional — available variant colors only)",
  materials: "string[] (optional)",
  printAreas: "string[] (optional)",
  collectionIdea: "string (optional)",
  rationale: "string (optional)",
  confidence: "number 0–1 (optional)",
  designBrief: "optional — server-side design brief handoff",
  relationshipGraph:
    "optional RelationshipGraphNode[] — used when designs[] missing; server synthesizes concepts",
  heroAnalysis: "optional — merged into collection; used for hero concept synthesis",
  commercialScore: "optional number — applied to hero concept when synthesizing",
  campaignPotential: "optional low|medium|high — applied to hero concept when synthesizing",
} as const;

export type ExpectedResearchSchema =
  | typeof EXPECTED_RESEARCH_SCHEMA
  | typeof EXPECTED_DESIGN_RESEARCH_SCHEMA;

export class ResearchParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: ExpectedResearchSchema;
  readonly receivedKeys?: string[];
  readonly missingFields?: string[];
  readonly validationIssues?: Array<{
    path: string;
    expected: string;
    received: unknown;
    message: string;
  }>;

  constructor(params: {
    message: string;
    stage: "json" | "validation";
    rawResponse?: string;
    strippedJson?: string;
    parsed?: unknown;
    missingFields?: string[];
    validationIssues?: ResearchParseError["validationIssues"];
    expectedSchema?: ExpectedResearchSchema;
  }) {
    super(params.message);
    this.name = "ResearchParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = params.expectedSchema ?? EXPECTED_RESEARCH_SCHEMA;
    this.receivedKeys =
      params.parsed && typeof params.parsed === "object" && params.parsed !== null
        ? Object.keys(params.parsed as Record<string, unknown>)
        : undefined;
    this.missingFields = params.missingFields;
    this.validationIssues = params.validationIssues;
  }

  toDetailedMessage(): string {
    const lines = [this.message, "", "Expected schema:", JSON.stringify(this.expectedSchema, null, 2)];

    if (this.receivedKeys) {
      lines.push("", `Received top-level keys: [${this.receivedKeys.join(", ")}]`);
    }

    if (this.missingFields?.length) {
      lines.push("", `Missing required fields: [${this.missingFields.join(", ")}]`);
    }

    if (this.validationIssues?.length) {
      lines.push("", "Validation mismatches:");
      for (const issue of this.validationIssues) {
        lines.push(
          `  - ${issue.path}: ${issue.message} (expected: ${issue.expected}, received: ${JSON.stringify(issue.received)})`,
        );
      }
    }

    if (this.parsed !== undefined) {
      lines.push("", "Received:", JSON.stringify(this.parsed, null, 2));
    }

    return lines.join("\n");
  }

  toLogPayload() {
    return {
      stage: this.stage,
      message: this.message,
      expectedSchema: this.expectedSchema,
      receivedKeys: this.receivedKeys,
      missingFields: this.missingFields,
      validationIssues: this.validationIssues,
      rawResponseLength: this.rawResponse?.length,
      rawResponsePreview: this.rawResponse?.slice(0, 2000),
      strippedJsonPreview: this.strippedJson?.slice(0, 2000),
      parsed: this.parsed,
    };
  }
}

const REQUIRED_TOP_LEVEL_FIELDS = [
  "title",
  "executiveSummary",
  "reportType",
  "keyFindings",
  "opportunities",
  "risks",
  "recommendations",
  "confidence",
  "fullAnalysis",
] as const;

const REPORT_TYPE_ALIASES: Record<string, string> = {
  competitor: "competitor",
  competitors: "competitor",
  wettbewerb: "competitor",
  trend: "trend",
  trends: "trend",
  design: "design",
  pricing: "pricing",
  price: "pricing",
  preise: "pricing",
  audience: "audience",
  zielgruppe: "audience",
  general: "audience",
  market: "audience",
};

const ADOPTION_LEVEL_ALIASES: Record<string, string> = {
  nascent: "nascent",
  emerging: "emerging",
  mainstream: "mainstream",
  declining: "declining",
  früh: "nascent",
  frueh: "nascent",
  aufstrebend: "emerging",
  etabliert: "mainstream",
  rückläufig: "declining",
  ruecklaeufig: "declining",
};

/** Strip markdown code fences and surrounding whitespace from model output. */
export function stripMarkdownJsonFences(raw: string): string {
  let text = raw.trim();

  const fenced = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced) {
    return fenced[1].trim();
  }

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json|JSON)?\s*\n?/, "");
    text = text.replace(/\n?```\s*$/, "");
  }

  return text.trim();
}

function zodIssueToDetail(
  issue: z.ZodIssue,
  data: unknown,
): { path: string; expected: string; received: unknown; message: string } {
  const path = issue.path.length ? issue.path.join(".") : "(root)";
  let received: unknown = data;

  for (const segment of issue.path) {
    if (received && typeof received === "object") {
      received = (received as Record<string, unknown>)[String(segment)];
    } else {
      received = undefined;
      break;
    }
  }

  return {
    path,
    expected: issue.code,
    received,
    message: issue.message,
  };
}

function findMissingRequiredFields(parsed: Record<string, unknown>): string[] {
  return REQUIRED_TOP_LEVEL_FIELDS.filter((field) => {
    const value = parsed[field];
    return value === undefined || value === null;
  });
}

const COMPETITOR_TIER_ALIASES: Record<string, string> = {
  direct: "direct",
  "tier 1": "direct",
  "tier-1": "direct",
  tier1: "direct",
  aspirational: "aspirational",
  "tier 2": "aspirational",
  "tier-2": "aspirational",
  tier2: "aspirational",
  emerging: "emerging",
  watchlist: "watchlist",
  watch: "watchlist",
};

function normalizeCompetitorTier(tier: unknown): string | undefined {
  if (typeof tier !== "string") return undefined;
  const key = tier.toLowerCase().trim();
  if (COMPETITOR_TIER_ALIASES[key]) return COMPETITOR_TIER_ALIASES[key];
  if (key.includes("direct") || key.includes("tier 1")) return "direct";
  if (key.includes("aspirational") || key.includes("tier 2")) return "aspirational";
  if (key.includes("emerging")) return "emerging";
  if (key.includes("watch")) return "watchlist";
  return ["direct", "aspirational", "emerging", "watchlist"].includes(key)
    ? key
    : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }
  return undefined;
}

function normalizeCompetitorReport(
  raw: unknown,
  adjustments: string[],
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const report = { ...(raw as Record<string, unknown>) };

  const milaeneOpportunities =
    report.brandOpportunities ??
    report.milaeneOpportunities ??
    report.milaene_opportunities;
  if (milaeneOpportunities && !report.brandOpportunities) {
    report.brandOpportunities = milaeneOpportunities;
    adjustments.push("mapped milaeneOpportunities → brandOpportunities");
  }

  for (const key of [
    "productCategories",
    "strengths",
    "weaknesses",
    "brandOpportunities",
  ] as const) {
    const normalized = normalizeStringArray(report[key]);
    if (normalized) report[key] = normalized;
  }

  return report;
}

function normalizeTrendReport(
  raw: unknown,
  adjustments: string[],
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const report = { ...(raw as Record<string, unknown>) };

  const relevance =
    report.relevanceForBrand ??
    report.relevanceForMilaene ??
    report.relevance_for_brand;
  if (relevance && !report.relevanceForBrand) {
    report.relevanceForBrand = relevance;
    adjustments.push("mapped relevanceForMilaene → relevanceForBrand");
  }

  if (typeof report.adoptionLevel === "string") {
    const key = report.adoptionLevel.toLowerCase().trim();
    const mapped = ADOPTION_LEVEL_ALIASES[key];
    if (mapped && mapped !== report.adoptionLevel) {
      adjustments.push(
        `normalized adoptionLevel: ${report.adoptionLevel} → ${mapped}`,
      );
      report.adoptionLevel = mapped;
    }
  }

  for (const key of ["designImplications", "contentImplications"] as const) {
    const normalized = normalizeStringArray(report[key]);
    if (normalized) report[key] = normalized;
  }

  return report;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deriveFallbackTitle(parsed: Record<string, unknown>): string {
  const trendReport = parsed.trendReport;
  if (trendReport && typeof trendReport === "object" && !Array.isArray(trendReport)) {
    const headline = (trendReport as Record<string, unknown>).headline;
    if (isNonEmptyString(headline)) return headline.trim();
  }

  const designBrief = parsed.designBrief;
  if (designBrief && typeof designBrief === "object" && !Array.isArray(designBrief)) {
    const collectionIdea = (designBrief as Record<string, unknown>).collectionIdea;
    if (isNonEmptyString(collectionIdea)) return collectionIdea.trim();
  }

  return "Research Report";
}

function ensureReportTitle(
  normalized: Record<string, unknown>,
  adjustments: string[],
): void {
  const coercedTitle = coerceConceptField(normalized.title);
  if (coercedTitle) {
    if (normalized.title !== coercedTitle) {
      adjustments.push("coerced title object → string");
    }
    normalized.title = coercedTitle;
    return;
  }

  for (const alias of ["reportTitle", "name", "headline"] as const) {
    const coercedAlias = coerceConceptField(normalized[alias]);
    if (coercedAlias) {
      normalized.title = coercedAlias;
      adjustments.push(`mapped ${alias} → title`);
      return;
    }
  }

  const fallback = deriveFallbackTitle(normalized);
  normalized.title = fallback;
  adjustments.push(`generated fallback title: ${fallback}`);
  console.info("[Research Run] Generated fallback title", { title: fallback });
}

/** Normalize common OpenAI field-name and type deviations before schema validation. */
export function normalizeResearchPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const adjustments: string[] = [];
  const normalized: Record<string, unknown> = { ...parsed };

  if (!normalized.executiveSummary) {
    if (typeof normalized.summary === "string") {
      normalized.executiveSummary = normalized.summary;
      adjustments.push("mapped summary → executiveSummary");
    } else if (typeof normalized.executive_summary === "string") {
      normalized.executiveSummary = normalized.executive_summary;
      adjustments.push("mapped executive_summary → executiveSummary");
    }
  }

  if (!normalized.keyFindings) {
    if (Array.isArray(normalized.findings)) {
      normalized.keyFindings = normalized.findings;
      adjustments.push("mapped findings → keyFindings");
    }
  }

  if (!normalized.fullAnalysis) {
    if (typeof normalized.analysis === "string") {
      normalized.fullAnalysis = normalized.analysis;
      adjustments.push("mapped analysis → fullAnalysis");
    } else if (typeof normalized.report === "string") {
      normalized.fullAnalysis = normalized.report;
      adjustments.push("mapped report → fullAnalysis");
    }
  }

  for (const field of ["opportunities", "risks", "recommendations"] as const) {
    const coerced = normalizeStringArray(normalized[field]);
    if (coerced && !normalized[field]) {
      normalized[field] = coerced;
      adjustments.push(`coerced ${field} to string array`);
    }
  }

  if (typeof normalized.reportType === "string") {
    const lowered = normalized.reportType.toLowerCase().trim();
    const mapped = REPORT_TYPE_ALIASES[lowered] ?? lowered;
    if (mapped !== normalized.reportType) {
      adjustments.push(
        `normalized reportType: ${normalized.reportType} → ${mapped}`,
      );
    }
    normalized.reportType = mapped;
  }

  if (normalized.confidence !== undefined) {
    if (typeof normalized.confidence === "string") {
      const coerced = Number.parseFloat(normalized.confidence);
      if (!Number.isNaN(coerced)) {
        adjustments.push(`coerced confidence string → number: ${normalized.confidence} → ${coerced}`);
        normalized.confidence = coerced;
      }
    }
    if (
      typeof normalized.confidence === "number" &&
      normalized.confidence > 1 &&
      normalized.confidence <= 100
    ) {
      const scaled = normalized.confidence / 100;
      adjustments.push(`scaled confidence percent → ratio: ${normalized.confidence} → ${scaled}`);
      normalized.confidence = scaled;
    }
  }

  if (normalized.competitorReport) {
    normalized.competitorReport = normalizeCompetitorReport(
      normalized.competitorReport,
      adjustments,
    );
  }

  if (normalized.trendReport) {
    normalized.trendReport = normalizeTrendReport(
      normalized.trendReport,
      adjustments,
    );
  }

  if (
    normalized.competitorIntelligence &&
    typeof normalized.competitorIntelligence === "object" &&
    !Array.isArray(normalized.competitorIntelligence)
  ) {
    const ci = {
      ...(normalized.competitorIntelligence as Record<string, unknown>),
    };
    if (Array.isArray(ci.competitors)) {
      ci.competitors = ci.competitors.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const competitor = { ...(entry as Record<string, unknown>) };
        const mappedTier = normalizeCompetitorTier(competitor.tier);
        if (mappedTier && mappedTier !== competitor.tier) {
          adjustments.push(
            `normalized competitor tier: ${String(competitor.tier)} → ${mappedTier}`,
          );
          competitor.tier = mappedTier;
        }
        return competitor;
      });
    }
    normalized.competitorIntelligence = ci;
  }

  for (const alias of [
    "connectorIntelligence",
    "intelligenceSignals",
  ] as const) {
    if (normalized[alias]) {
      normalized[alias] = normalizeConnectorIntelligence(
        normalized[alias],
        adjustments,
      );
    }
  }

  if (normalized.connectorScores) {
    const scores = normalizeConnectorScores(normalized.connectorScores);
    if (scores) normalized.connectorScores = scores;
  }

  if (normalized.designBrief) {
    normalized.designBrief = normalizeDesignBrief(
      normalized.designBrief,
      adjustments,
    );
  }

  for (const field of ["opportunities"] as const) {
    const coerced = normalizeOpportunityStrings(
      normalized[field],
      adjustments,
      field,
    );
    if (coerced) normalized[field] = coerced;
  }

  ensureReportTitle(normalized, adjustments);

  return { normalized, adjustments };
}

function normalizePercentScore(value: unknown, fallback = 55): number {
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace("%", "").trim());
    if (!Number.isNaN(parsed)) return normalizePercentScore(parsed, fallback);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeConnectorScores(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  return {
    socialScore: normalizePercentScore(source.socialScore),
    demandScore: normalizePercentScore(source.demandScore),
    trendScore: normalizePercentScore(source.trendScore),
    confidence: normalizePercentScore(source.confidence, 60),
  };
}

function normalizeConnectorIntelligence(
  raw: unknown,
  adjustments: string[],
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const source = { ...(raw as Record<string, unknown>) };
  const scores = normalizeConnectorScores(source.scores ?? source.connectorScores);
  if (scores) {
    source.scores = scores;
    adjustments.push("normalized connector intelligence scores");
  }

  if (Array.isArray(source.connectors)) {
    source.connectors = source.connectors.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const connector = { ...(entry as Record<string, unknown>) };
      if (typeof connector.mode === "string") {
        const mode = connector.mode.toLowerCase();
        connector.mode = mode === "live" ? "live" : "simulated";
      }
      for (const key of [
        "socialScore",
        "demandScore",
        "trendScore",
        "confidence",
      ] as const) {
        if (connector[key] !== undefined) {
          connector[key] = normalizePercentScore(connector[key]);
        }
      }
      return connector;
    });
  }

  return source;
}

function normalizeDesignBrief(
  raw: unknown,
  adjustments: string[],
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const brief = { ...(raw as Record<string, unknown>) };

  for (const key of [
    "trendScore",
    "competitorScore",
    "socialScore",
    "demandScore",
    "confidence",
  ] as const) {
    if (brief[key] !== undefined) {
      brief[key] = normalizePercentScore(brief[key]);
    }
  }

  if (brief.connectorScores) {
    const scores = normalizeConnectorScores(brief.connectorScores);
    if (scores) brief.connectorScores = scores;
  } else if (brief.socialScore || brief.demandScore || brief.trendScore) {
    brief.connectorScores = {
      socialScore: normalizePercentScore(brief.socialScore),
      demandScore: normalizePercentScore(brief.demandScore),
      trendScore: normalizePercentScore(brief.trendScore),
      confidence: normalizePercentScore(brief.confidence, 60),
    };
    adjustments.push("synthesized designBrief.connectorScores from score fields");
  }

  if (typeof brief.intelligenceMode === "string") {
    brief.intelligenceMode =
      brief.intelligenceMode.toLowerCase() === "live" ? "live" : "simulated";
  }

  if (!brief.generatedAt) {
    brief.generatedAt = new Date().toISOString();
    adjustments.push("defaulted designBrief.generatedAt");
  }

  if (typeof brief.rationale === "string" && brief.rationale.length < 20) {
    brief.rationale = `${brief.rationale} Basierend auf Live-Intelligence und Marktsignalen.`;
    adjustments.push("padded designBrief.rationale");
  }

  return brief;
}

const ROLE_CREATIVE_APPROACH: Record<CollectionRole, CreativeApproach> = {
  "Hero Piece": "Japanese Editorial",
  "Core Essential": "Luxury Minimalism",
  "Statement Piece": "Symbolic Illustration",
  "Supporting Piece": "Minimal Back Print",
  "Limited Piece": "Abstract Graphic",
};

function coerceCollectionRole(value: unknown): CollectionRole {
  const raw = coerceConceptField(value).toLowerCase();
  if (raw.includes("limited")) return "Limited Piece";
  if (raw.includes("hero")) return "Hero Piece";
  if (raw.includes("core") || raw.includes("essential")) return "Core Essential";
  if (raw.includes("statement")) return "Statement Piece";
  if (raw.includes("supporting")) return "Supporting Piece";
  const hit = COLLECTION_ROLES.find((role) => raw.includes(role.toLowerCase()));
  return hit ?? "Supporting Piece";
}

function coerceRelationshipGraph(value: unknown): RelationshipGraphNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is RelationshipGraphNode =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function mergeCollectionIntelligenceFields(
  normalized: Record<string, unknown>,
  adjustments: string[],
): void {
  const collection =
    normalized.collection && typeof normalized.collection === "object"
      ? { ...(normalized.collection as Record<string, unknown>) }
      : {};

  if (normalized.heroAnalysis && typeof normalized.heroAnalysis === "object") {
    collection.heroAnalysis = normalized.heroAnalysis;
    adjustments.push("merged top-level heroAnalysis into collection");
  }

  if (Object.keys(collection).length > 0) {
    normalized.collection = collection;
  }
}

function stripCollectionOnlyParseFields(normalized: Record<string, unknown>): void {
  delete normalized.relationshipGraph;
  delete normalized.commercialScore;
  delete normalized.campaignPotential;
}

/**
 * When the LLM returns collection metadata without designs[], build 5 role-based
 * concept stubs for normalizeDesignConcepts + applyCollectionPipeline.
 */
function synthesizeDesignsFromCollection(
  parsed: Record<string, unknown>,
  context: {
    title?: string;
    products?: string[];
    colors?: string[];
    targetAudience?: string;
    collectionIdea?: string;
  },
  adjustments: string[],
): unknown[] {
  const collection = (parsed.collection ?? {}) as Record<string, unknown>;
  const graph = coerceRelationshipGraph(parsed.relationshipGraph);
  const heroAnalysis =
    parsed.heroAnalysis && typeof parsed.heroAnalysis === "object"
      ? (parsed.heroAnalysis as Record<string, unknown>)
      : collection.heroAnalysis && typeof collection.heroAnalysis === "object"
        ? (collection.heroAnalysis as Record<string, unknown>)
        : undefined;

  const collectionName =
    coerceConceptField(collection.name) ||
    context.collectionIdea ||
    context.title ||
    "Milaene Capsule";
  const heroDesignId =
    coerceConceptField(collection.heroDesignId) || "hero-piece";
  const supportingIds = Array.isArray(collection.supportingDesignIds)
    ? collection.supportingDesignIds.map((id) => String(id))
    : [];

  const mood = coerceConceptField(collection.mood) || "calm reflection";
  const story =
    coerceConceptField(collection.story) ||
    `${collectionName} explores ${mood} through minimal Milaene symbolism.`;
  const philosophy =
    coerceConceptField(collection.philosophy) ||
    MILAENE_BRAND_DNA.philosophy.slice(0, 3).join(", ");
  const targetAudience =
    coerceConceptField(collection.targetAudience) ||
    context.targetAudience ||
    "25-35 premium minimal streetwear consumers seeking emotional depth";

  const heroProduct =
    collection.heroProduct && typeof collection.heroProduct === "object"
      ? (collection.heroProduct as Record<string, unknown>)
      : undefined;
  const defaultProduct =
    coerceConceptField(heroProduct?.product) ||
    context.products?.[0] ||
    "Faith Oversized Hoodie";

  const colorDirection = Array.isArray(collection.colorDirection)
    ? collection.colorDirection.map((color) => String(color))
    : context.colors?.length
      ? context.colors
      : ["washed black", "off-white", "concrete grey"];

  const nodesById = new Map<string, RelationshipGraphNode>();
  for (const node of graph) {
    const id = coerceConceptField(node.designId ?? node.id);
    if (id) nodesById.set(id, node);
  }

  const roleAssignments = new Map<
    CollectionRole,
    { id: string; node?: RelationshipGraphNode }
  >();

  for (const node of graph) {
    const role = coerceCollectionRole(node.collectionRole ?? node.role);
    if (roleAssignments.has(role)) continue;
    const id =
      coerceConceptField(node.designId ?? node.id) ||
      `${role.toLowerCase().replace(/\s+/g, "-")}-1`;
    roleAssignments.set(role, { id, node });
  }

  if (!roleAssignments.has("Hero Piece")) {
    roleAssignments.set("Hero Piece", {
      id: heroDesignId,
      node: nodesById.get(heroDesignId),
    });
  }

  let supportIndex = 0;
  for (const role of COLLECTION_ROLES) {
    if (role === "Hero Piece" || roleAssignments.has(role)) continue;
    const supportId = supportingIds[supportIndex];
    supportIndex += 1;
    if (supportId) {
      roleAssignments.set(role, {
        id: supportId,
        node: nodesById.get(supportId),
      });
    }
  }

  for (const role of COLLECTION_ROLES) {
    if (roleAssignments.has(role)) continue;
    const slug = role.toLowerCase().replace(/\s+/g, "-");
    roleAssignments.set(role, {
      id: `${slug}-${collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16)}`,
    });
  }

  const topCommercial =
    typeof parsed.commercialScore === "number" ? parsed.commercialScore : undefined;
  const topCampaign = parsed.campaignPotential;

  adjustments.push(
    `synthesized ${COLLECTION_ROLES.length} design concept stubs from collection-only payload`,
  );

  return COLLECTION_ROLES.map((role, index) => {
    const assignment = roleAssignments.get(role)!;
    const { id, node } = assignment;
    const isHero = role === "Hero Piece";
    const approach = ROLE_CREATIVE_APPROACH[role];

    const stub: Record<string, unknown> = {
      designId: id,
      title:
        coerceConceptField(node?.title ?? node?.name) ||
        `${collectionName} — ${role}`,
      collectionRole: role,
      creativeApproach: approach,
      product: coerceConceptField(node?.product) || defaultProduct,
      color:
        coerceConceptField(node?.color) ||
        colorDirection[index % colorDirection.length],
      printArea: index % 2 === 0 ? "Front" : "Back",
      emotion:
        coerceConceptField(node?.emotion) ||
        mood.split(/\s+/)[0] ||
        "Silence",
      targetAudience,
      visualConcept:
        coerceConceptField(node?.visualConcept) ||
        `${mood} ${role.toLowerCase()} visual — editorial ${approach.toLowerCase()} with quiet luxury restraint and symbolic negative space`,
      designDescription: `${story} ${role} expression for ${collectionName}.`,
      symbolism: `${philosophy} — ${role.toLowerCase()} symbolism within the capsule narrative.`,
      message: isHero ? mood.toUpperCase() : "",
      typography: isHero
        ? "Editorial serif, wide tracking, single restrained text block"
        : "No type — pure graphic restraint",
      rationale: `Synthesized ${role.toLowerCase()} for collection "${collectionName}" from collection metadata.`,
      supportsDesignId: isHero
        ? undefined
        : coerceConceptField(node?.supportsDesignId ?? node?.supports) ||
          heroDesignId,
      relationshipReason: coerceConceptField(node?.relationshipReason),
    };

    if (isHero) {
      if (heroAnalysis?.commercialScore !== undefined) {
        stub.commercialScore = heroAnalysis.commercialScore;
      } else if (topCommercial !== undefined) {
        stub.commercialScore = topCommercial;
      }
      if (heroAnalysis?.campaignPotential) {
        stub.campaignPotential = heroAnalysis.campaignPotential;
      } else if (topCampaign) {
        stub.campaignPotential = topCampaign;
      }
      if (heroAnalysis?.heroScore !== undefined) {
        stub.heroScore = heroAnalysis.heroScore;
      }
    }

    return stub;
  });
}

/** Detect design/collection payloads before classic research normalization. */
export function isDesignResearchPayload(
  parsed: Record<string, unknown>,
): boolean {
  if (Array.isArray(parsed.designs) && parsed.designs.length > 0) {
    return true;
  }
  return (
    parsed.collection !== undefined &&
    typeof parsed.collection === "object" &&
    parsed.collection !== null &&
    !Array.isArray(parsed.collection)
  );
}

/** Collection metadata without designs[] — concepts are synthesized server-side. */
export function isCollectionOnlyResearchPayload(
  parsed: Record<string, unknown>,
): boolean {
  if (!isDesignResearchPayload(parsed)) return false;
  return !(Array.isArray(parsed.designs) && parsed.designs.length > 0);
}

function normalizeDesignSchemaFields(
  normalized: Record<string, unknown>,
  adjustments: string[],
): void {
  const collection = normalized.collection;
  if (collection && typeof collection === "object" && !Array.isArray(collection)) {
    const col = { ...(collection as Record<string, unknown>) };

    if (col.collectionScore !== undefined) {
      const coerced = coercePercentScore(col.collectionScore);
      if (coerced !== undefined && coerced !== col.collectionScore) {
        col.collectionScore = coerced;
        adjustments.push(`coerced collection.collectionScore → ${coerced}`);
      }
    }

    if (col.heroProduct && typeof col.heroProduct === "object") {
      const heroProduct = { ...(col.heroProduct as Record<string, unknown>) };
      if (heroProduct.commercialConfidence !== undefined) {
        const coerced = coercePercentScore(heroProduct.commercialConfidence);
        if (coerced !== undefined && coerced !== heroProduct.commercialConfidence) {
          heroProduct.commercialConfidence = coerced;
          adjustments.push(
            `coerced collection.heroProduct.commercialConfidence → ${coerced}`,
          );
        }
      }
      if (heroProduct.estimatedRetailPrice !== undefined) {
        const price = coerceRetailPrice(heroProduct.estimatedRetailPrice);
        if (price && price !== heroProduct.estimatedRetailPrice) {
          heroProduct.estimatedRetailPrice = price;
          adjustments.push(
            `coerced collection.heroProduct.estimatedRetailPrice → ${price}`,
          );
        }
      }
      col.heroProduct = heroProduct;
    }

    for (const block of ["ceoAnalysis", "heroAnalysis"] as const) {
      if (!col[block] || typeof col[block] !== "object") continue;
      const analysis = { ...(col[block] as Record<string, unknown>) };
      const fields =
        block === "ceoAnalysis"
          ? (["commercialConfidence"] as const)
          : (["heroScore", "commercialScore"] as const);
      for (const field of fields) {
        if (analysis[field] === undefined) continue;
        const coerced = coercePercentScore(analysis[field]);
        if (coerced !== undefined && coerced !== analysis[field]) {
          analysis[field] = coerced;
          adjustments.push(`coerced collection.${block}.${field} → ${coerced}`);
        }
      }
      if (analysis.campaignPotential !== undefined) {
        const potential = coerceCampaignPotential(analysis.campaignPotential);
        if (potential && potential !== analysis.campaignPotential) {
          analysis.campaignPotential = potential;
          adjustments.push(
            `coerced collection.${block}.campaignPotential → ${potential}`,
          );
        }
      }
      col[block] = analysis;
    }

    normalized.collection = col;
  }

  if (Array.isArray(normalized.designs)) {
    normalized.designs = normalized.designs.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return entry;
      }
      const design = { ...(entry as Record<string, unknown>) };
      for (const field of ["commercialScore", "heroScore", "dnaScore"] as const) {
        if (design[field] === undefined) continue;
        const coerced = coercePercentScore(design[field]);
        if (coerced !== undefined && coerced !== design[field]) {
          design[field] = coerced;
          adjustments.push(`coerced designs[${index}].${field} → ${coerced}`);
        }
      }
      if (design.campaignPotential !== undefined) {
        const potential = coerceCampaignPotential(design.campaignPotential);
        if (potential && potential !== design.campaignPotential) {
          design.campaignPotential = potential;
          adjustments.push(
            `coerced designs[${index}].campaignPotential → ${potential}`,
          );
        }
      }
      if (design.repeatabilityScore !== undefined) {
        const repeatability = coerceRepeatabilityScore(design.repeatabilityScore);
        if (repeatability && repeatability !== design.repeatabilityScore) {
          design.repeatabilityScore = repeatability;
          adjustments.push(
            `coerced designs[${index}].repeatabilityScore → ${repeatability}`,
          );
        }
      }
      return design;
    });
  }

  if (normalized.commercialScore !== undefined) {
    const coerced = coercePercentScore(normalized.commercialScore);
    if (coerced !== undefined && coerced !== normalized.commercialScore) {
      normalized.commercialScore = coerced;
      adjustments.push(`coerced top-level commercialScore → ${coerced}`);
    }
  }

  if (normalized.campaignPotential !== undefined) {
    const potential = coerceCampaignPotential(normalized.campaignPotential);
    if (potential && potential !== normalized.campaignPotential) {
      normalized.campaignPotential = potential;
      adjustments.push(`coerced top-level campaignPotential → ${potential}`);
    }
  }
}

function normalizeDesignResearchPayload(
  parsed: Record<string, unknown>,
  detailMode: ResearchDetailMode = DEFAULT_RESEARCH_DETAIL_MODE,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const adjustments: string[] = [];
  const normalized: Record<string, unknown> = { ...parsed };

  ensureReportTitle(normalized, adjustments);
  mergeCollectionIntelligenceFields(normalized, adjustments);

  const context = {
    title: coerceConceptField(normalized.title),
    products: normalizeStringArray(normalized.products),
    colors: normalizeStringArray(normalized.colors),
    printAreas: normalizeStringArray(normalized.printAreas),
    styleDirection: coerceConceptField(normalized.styleDirection),
    targetAudience: coerceConceptField(normalized.targetAudience),
    collectionIdea: coerceConceptField(normalized.collectionIdea),
    detailMode,
  };

  let rawDesigns = normalized.designs;
  if (!Array.isArray(rawDesigns) || rawDesigns.length === 0) {
    if (isCollectionOnlyResearchPayload(normalized)) {
      rawDesigns = synthesizeDesignsFromCollection(normalized, context, adjustments);
      normalized.designs = rawDesigns;
    }
  }

  const designs = normalizeDesignConcepts(
    rawDesigns,
    context,
    adjustments,
  );
  if (designs) {
    const collectionResult = applyCollectionPipeline(
      designs,
      {
        title: context.title,
        collectionIdea: context.collectionIdea,
        targetAudience: context.targetAudience,
        colors: context.colors,
        rationale: coerceConceptField(normalized.rationale),
        collection:
          normalized.collection && typeof normalized.collection === "object"
            ? (normalized.collection as Partial<import("./types").ResearchCollection>)
            : undefined,
      },
      adjustments,
    );
    const finalizedDesigns = compactDesignConceptsForDetailMode(
      finalizeDesignConceptsForValidation(collectionResult.designs, context),
      detailMode,
    );
    const heroDesign = finalizedDesigns.find(
      (design) => design.designId === collectionResult.collection.heroDesignId,
    );
    normalized.designs = finalizedDesigns;
    normalized.collection = {
      ...collectionResult.collection,
      heroProduct: {
        ...collectionResult.collection.heroProduct,
        product:
          collectionResult.collection.heroProduct.product.trim() ||
          heroDesign?.product ||
          "Faith Oversized Hoodie",
      },
    };
  }

  stripCollectionOnlyParseFields(normalized);
  normalized.brandDNA = MILAENE_BRAND_DNA;

  for (const field of [
    "products",
    "colors",
    "materials",
    "printAreas",
  ] as const) {
    const coerced = normalizeStringArray(normalized[field]);
    if (coerced) normalized[field] = coerced;
  }

  if (normalized.confidence !== undefined) {
    if (typeof normalized.confidence === "string") {
      const coerced = Number.parseFloat(normalized.confidence);
      if (!Number.isNaN(coerced)) {
        adjustments.push(`coerced confidence string → number: ${normalized.confidence} → ${coerced}`);
        normalized.confidence = coerced;
      }
    }
    if (
      typeof normalized.confidence === "number" &&
      normalized.confidence > 1 &&
      normalized.confidence <= 100
    ) {
      const scaled = normalized.confidence / 100;
      adjustments.push(`scaled confidence percent → ratio: ${normalized.confidence} → ${scaled}`);
      normalized.confidence = scaled;
    }
  }

  if (!normalized.collectionIdea && isNonEmptyString(normalized.title)) {
    normalized.collectionIdea = normalized.title;
    adjustments.push("defaulted collectionIdea from title");
  }

  if (normalized.designBrief) {
    normalized.designBrief = normalizeDesignBrief(
      normalized.designBrief,
      adjustments,
    );
  }

  normalizeDesignSchemaFields(normalized, adjustments);

  return { normalized, adjustments };
}

function logFinalValidationIssue(
  issues: z.ZodIssue[],
  parsed: Record<string, unknown>,
): void {
  console.error("FINAL VALIDATION ISSUE");
  console.error(JSON.stringify(issues, null, 2));

  const first = issues[0];
  if (first) {
    console.error("PATH:", first.path);
    console.error(
      "EXPECTED:",
      "expected" in first ? first.expected : undefined,
    );
    console.error(
      "RECEIVED:",
      "received" in first ? first.received : zodIssueToDetail(first, parsed).received,
    );
    console.error("MESSAGE:", first.message);
  }

  const designs = Array.isArray(parsed.designs) ? parsed.designs : [];
  console.log(
    "FINAL DESIGN SUMMARY",
    designs.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return entry;
      }
      const design = entry as Record<string, unknown>;
      return {
        title: design.title,
        role: design.collectionRole,
        heroScore: design.heroScore,
        dnaScore: design.dnaScore,
        printArea: design.printArea,
      };
    }),
  );
}

function validateDesignResearchPayload(
  parsed: Record<string, unknown>,
  context: ValidateContext,
): DesignResearchOutput {
  const result = designResearchOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  logFinalValidationIssue(result.error.issues, parsed);
  logValidationIssues(result.error.issues, parsed, "Design schema validation issues");

  const validationIssues = result.error.issues.slice(0, 5).map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  throw new ResearchParseError({
    message: `Design schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed,
    validationIssues,
    expectedSchema: EXPECTED_DESIGN_RESEARCH_SCHEMA,
  });
}

function normalizeOpportunityStrings(
  value: unknown,
  adjustments: string[],
  field: string,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const title = obj.title ?? obj.name ?? obj.collection;
        const scores = obj.scores as Record<string, unknown> | undefined;
        const scoreNote = scores
          ? ` — Demand ${normalizePercentScore(scores.demandScore)}% · Social ${normalizePercentScore(scores.socialScore)}%`
          : "";
        if (typeof title === "string") {
          adjustments.push(`coerced ${field} object → string`);
          return `${title}${scoreNote}`.trim();
        }
      }
      return "";
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function logValidationIssues(
  issues: z.ZodIssue[],
  parsed: Record<string, unknown>,
  label: string,
): void {
  const topIssues = issues.slice(0, 5);
  const details = topIssues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    code: issue.code,
    message: issue.message,
    expected: "expected" in issue ? issue.expected : undefined,
  }));

  console.error(`[Research Run] ${label}`, {
    issueCount: issues.length,
    issues: details,
    zodIssues: topIssues,
    parsedPreview: JSON.stringify(parsed, null, 2).slice(0, 4000),
  });

  if (issues.length > 5) {
    console.error(
      `[Research Run] ${label} — ${issues.length - 5} additional issue(s) omitted from log`,
    );
  }
}

function isOptionalNestedRoot(path: string): boolean {
  return (
    path === "competitorIntelligence" ||
    path === "marketingMemory" ||
    path === "designMemory" ||
    path === "designBrief" ||
    path === "connectorIntelligence" ||
    path === "intelligenceSignals" ||
    path === "connectorScores"
  );
}

const OPTIONAL_STRIP_KEYS = [
  "competitorIntelligence",
  "marketingMemory",
  "designMemory",
  "designBrief",
  "connectorIntelligence",
  "intelligenceSignals",
  "connectorScores",
] as const;

function hasCompetitorReportIssues(
  issues: z.ZodIssue[],
  reportType: unknown,
): boolean {
  return (
    reportType === "competitor" &&
    issues.some((issue) => String(issue.path[0] ?? "") === "competitorReport")
  );
}

function hasTrendReportIssues(
  issues: z.ZodIssue[],
  reportType: unknown,
): boolean {
  return (
    reportType === "trend" &&
    issues.some((issue) => String(issue.path[0] ?? "") === "trendReport")
  );
}

interface ValidateContext {
  rawResponse: string;
  strippedJson: string;
  strippedOptionalBlocks?: boolean;
}

function validateResearchPayload(
  parsed: Record<string, unknown>,
  context: ValidateContext,
): ResearchOutput {
  const missingFields = findMissingRequiredFields(parsed);
  let result = researchOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  logValidationIssues(result.error.issues, parsed, "Schema validation issues");

  if (hasCompetitorReportIssues(result.error.issues, parsed.reportType)) {
    const partial =
      parsed.competitorReport &&
      typeof parsed.competitorReport === "object" &&
      !Array.isArray(parsed.competitorReport)
        ? (parsed.competitorReport as Record<string, unknown>)
        : undefined;

    const enrichAdjustments = enrichResearchPayload({
      ...parsed,
      competitorReport: partial,
    });
    if (enrichAdjustments.length > 0) {
      console.info("[Research Run] Re-enriched competitorReport after validation issues", {
        adjustments: enrichAdjustments,
      });
    }

    result = researchOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    logValidationIssues(
      result.error.issues,
      parsed,
      "Schema validation issues after competitorReport enrich",
    );
  }

  if (hasTrendReportIssues(result.error.issues, parsed.reportType)) {
    const partial =
      parsed.trendReport &&
      typeof parsed.trendReport === "object" &&
      !Array.isArray(parsed.trendReport)
        ? (parsed.trendReport as Record<string, unknown>)
        : undefined;

    const enrichAdjustments = enrichResearchPayload({
      ...parsed,
      trendReport: partial,
    });
    if (enrichAdjustments.length > 0) {
      console.info("[Research Run] Re-enriched trendReport after validation issues", {
        adjustments: enrichAdjustments,
      });
    }

    result = researchOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    logValidationIssues(
      result.error.issues,
      parsed,
      "Schema validation issues after trendReport enrich",
    );
  }

  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  const onlyOptionalNestedFailures = result.error.issues.every((issue) => {
    const root = String(issue.path[0] ?? "");
    return isOptionalNestedRoot(root);
  });

  if (onlyOptionalNestedFailures) {
    if (context.strippedOptionalBlocks) {
      logValidationIssues(
        result.error.issues,
        parsed,
        "Schema validation failed after stripping optional blocks",
      );
      throw new ResearchParseError({
        message: `Schema validation failed with ${result.error.issues.length} issue(s) after stripping optional blocks`,
        stage: "validation",
        rawResponse: context.rawResponse,
        strippedJson: context.strippedJson,
        parsed,
        missingFields,
        validationIssues,
      });
    }

    const stripped = { ...parsed };
    const removed: string[] = [];
    for (const key of OPTIONAL_STRIP_KEYS) {
      if (stripped[key] !== undefined && isOptionalNestedRoot(key)) {
        removed.push(key);
        delete stripped[key];
      }
    }
    console.warn("[Research Run] Stripped invalid optional intelligence blocks", {
      removed,
      validationIssues,
    });
    return validateResearchPayload(stripped, {
      ...context,
      strippedOptionalBlocks: true,
    });
  }

  logValidationIssues(
    result.error.issues,
    parsed,
    "Schema validation failed — unrecoverable",
  );

  throw new ResearchParseError({
    message: `Schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed,
    missingFields,
    validationIssues,
  });
}

export interface ParseResearchOutputOptions {
  detailMode?: ResearchDetailMode;
}

export function parseResearchOutput(
  raw: string,
  options: ParseResearchOutputOptions = {},
): ParsedResearchOutput {
  const detailMode = options.detailMode ?? DEFAULT_RESEARCH_DETAIL_MODE;
  assertCompleteJsonResponse(raw);
  const strippedJson = stripMarkdownJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(strippedJson);
  } catch (jsonError) {
    throw new ResearchParseError({
      message: `JSON parse failed: ${jsonError instanceof Error ? jsonError.message : "unknown error"}`,
      stage: "json",
      rawResponse: raw,
      strippedJson,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ResearchParseError({
      message: "Parsed response is not a JSON object",
      stage: "validation",
      rawResponse: raw,
      strippedJson,
      parsed,
    });
  }

  const record = parsed as Record<string, unknown>;

  if (isDesignResearchPayload(record)) {
    const collectionOnly = isCollectionOnlyResearchPayload(record);
    const { normalized, adjustments } = normalizeDesignResearchPayload(record, detailMode);

    if (adjustments.length > 0) {
      console.info("[Research Run] Normalized design model output", {
        adjustments: adjustments.slice(0, 20),
        adjustmentCount: adjustments.length,
        collectionOnly,
        detailMode,
      });
    }

    console.info("[Research Run] Parsed design JSON (pre-validation)", {
      designCount: Array.isArray(normalized.designs) ? normalized.designs.length : 0,
      detailMode,
    });

    const validated = validateDesignResearchPayload(normalized, {
      rawResponse: raw,
      strippedJson,
    });
    const finalized = applyFinalConsistencyToDesignOutput(validated, adjustments);

    console.log(
      "[FINAL PIPELINE] STEP 11 before",
      pipelineStepSnapshot(finalized.designs, finalized.collection),
    );
    try {
      assertFinalCollectionConsistency(finalized);
      console.log(
        "[FINAL PIPELINE] STEP 11 after",
        pipelineStepSnapshot(finalized.designs, finalized.collection),
      );
    } catch (error) {
      logFinalPipelineCrash(
        11,
        "final assertions",
        finalized.designs,
        finalized.collection,
        error,
      );
      throw error;
    }

    if (adjustments.length > 0) {
      console.info("[Research Run] Final consistency adjustments", {
        adjustments: adjustments.slice(-10),
        adjustmentCount: adjustments.length,
      });
    }

    return {
      kind: "design",
      output: finalized,
    };
  }

  const { normalized, adjustments } = normalizeResearchPayload(record);

  const enrichAdjustments = enrichResearchPayload(normalized);
  const allAdjustments = [...adjustments, ...enrichAdjustments];

  if (allAdjustments.length > 0) {
    console.info("[Research Run] Normalized model output", {
      adjustments: allAdjustments.slice(0, 20),
      adjustmentCount: allAdjustments.length,
    });
  }

  console.info("[Research Run] Parsed JSON (pre-validation)", {
    keys: Object.keys(normalized),
  });

  return {
    kind: "research",
    output: validateResearchPayload(normalized, { rawResponse: raw, strippedJson }),
  };
}
