import { z } from "zod";
import { enrichResearchPayload } from "./enrich-output";
import {
  designResearchOutputSchema,
  researchOutputSchema,
  type DesignResearchOutput,
  type ParsedResearchOutput,
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
  designs: "string[] (required, 1–12 design ideas)",
  products: "string[] (optional — real catalog products only)",
  colors: "string[] (optional — available variant colors only)",
  materials: "string[] (optional)",
  printAreas: "string[] (optional)",
  collectionIdea: "string (optional)",
  rationale: "string (optional)",
  confidence: "number 0–1 (optional)",
  designBrief: "optional — server-side design brief handoff",
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
  if (isNonEmptyString(normalized.title)) {
    normalized.title = normalized.title.trim();
    return;
  }

  for (const alias of ["reportTitle", "name", "headline"] as const) {
    if (isNonEmptyString(normalized[alias])) {
      normalized.title = String(normalized[alias]).trim();
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

/** Detect design-idea payloads before classic research normalization. */
export function isDesignResearchPayload(
  parsed: Record<string, unknown>,
): boolean {
  return Array.isArray(parsed.designs) && parsed.designs.length > 0;
}

function normalizeDesignResearchPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const adjustments: string[] = [];
  const normalized: Record<string, unknown> = { ...parsed };

  ensureReportTitle(normalized, adjustments);

  const designs = normalizeStringArray(normalized.designs);
  if (designs) {
    normalized.designs = designs;
  }

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

  return { normalized, adjustments };
}

function validateDesignResearchPayload(
  parsed: Record<string, unknown>,
  context: ValidateContext,
): DesignResearchOutput {
  const result = designResearchOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  logValidationIssues(result.error.issues, parsed, "Design schema validation issues");

  const validationIssues = result.error.issues.map((issue) =>
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
  const details = issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    code: issue.code,
    message: issue.message,
    expected: "expected" in issue ? issue.expected : undefined,
  }));

  console.error(`[Research Run] ${label}`, {
    issueCount: issues.length,
    issues: details,
    zodIssues: issues,
    parsedPreview: JSON.stringify(parsed, null, 2).slice(0, 4000),
  });
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

export function parseResearchOutput(raw: string): ParsedResearchOutput {
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
    const { normalized, adjustments } = normalizeDesignResearchPayload(record);

    if (adjustments.length > 0) {
      console.info("[Research Run] Normalized design model output", {
        adjustments,
      });
    }

    console.info(
      "[Research Run] Parsed design JSON (pre-validation):",
      JSON.stringify(normalized, null, 2),
    );

    return {
      kind: "design",
      output: validateDesignResearchPayload(normalized, {
        rawResponse: raw,
        strippedJson,
      }),
    };
  }

  const { normalized, adjustments } = normalizeResearchPayload(record);

  const enrichAdjustments = enrichResearchPayload(normalized);
  const allAdjustments = [...adjustments, ...enrichAdjustments];

  if (allAdjustments.length > 0) {
    console.info("[Research Run] Normalized model output", {
      adjustments: allAdjustments,
    });
  }

  console.info("[Research Run] Parsed JSON (pre-validation):", JSON.stringify(normalized, null, 2));

  return {
    kind: "research",
    output: validateResearchPayload(normalized, { rawResponse: raw, strippedJson }),
  };
}
