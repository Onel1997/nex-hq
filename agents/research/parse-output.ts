import { z } from "zod";
import { researchOutputSchema, type ResearchOutput } from "./types";

export const EXPECTED_RESEARCH_SCHEMA = {
  title: "string (required)",
  summary: "string (required)",
  reportType: "competitor | trend | design | pricing | general (required)",
  keyFindings: "string[] (required, 1–8 items)",
  confidence: "number 0–1 (required)",
  fullAnalysis: "string (required)",
  competitorIntelligence: "optional { competitors, competitiveEdge, ... }",
  marketingMemory: "optional { name, objective, notes, ... }",
  designMemory: "optional { silhouettes, moodKeywords, ... }",
} as const;

export class ResearchParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_RESEARCH_SCHEMA;
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
  }) {
    super(params.message);
    this.name = "ResearchParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_RESEARCH_SCHEMA;
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
  "summary",
  "reportType",
  "keyFindings",
  "confidence",
  "fullAnalysis",
] as const;

/** Strip markdown code fences and surrounding whitespace from model output. */
export function stripMarkdownJsonFences(raw: string): string {
  let text = raw.trim();

  // ```json ... ``` or ``` ... ```
  const fenced = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced) {
    return fenced[1].trim();
  }

  // Leading fence without reliable closing match
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
  "tier1": "direct",
  aspirational: "aspirational",
  "tier 2": "aspirational",
  "tier-2": "aspirational",
  "tier2": "aspirational",
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

/** Normalize common OpenAI field-name and type deviations before schema validation. */
export function normalizeResearchPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const adjustments: string[] = [];
  const normalized: Record<string, unknown> = { ...parsed };

  if (!normalized.keyFindings) {
    if (Array.isArray(normalized.findings)) {
      normalized.keyFindings = normalized.findings;
      adjustments.push("mapped findings → keyFindings");
    } else if (Array.isArray(normalized.recommendations)) {
      normalized.keyFindings = normalized.recommendations;
      adjustments.push("mapped recommendations → keyFindings");
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

  if (typeof normalized.reportType === "string") {
    const lowered = normalized.reportType.toLowerCase().trim();
    if (lowered !== normalized.reportType) {
      adjustments.push(`normalized reportType casing: ${normalized.reportType} → ${lowered}`);
    }
    normalized.reportType = lowered;
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

  return { normalized, adjustments };
}

function validateResearchPayload(
  parsed: Record<string, unknown>,
  context: { rawResponse: string; strippedJson: string },
): ResearchOutput {
  const missingFields = findMissingRequiredFields(parsed);
  const result = researchOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  const onlyOptionalNestedFailures = result.error.issues.every((issue) => {
    const root = String(issue.path[0] ?? "");
    return (
      root === "competitorIntelligence" ||
      root === "marketingMemory" ||
      root === "designMemory"
    );
  });

  if (onlyOptionalNestedFailures) {
    const stripped = { ...parsed };
    const removed: string[] = [];
    for (const key of [
      "competitorIntelligence",
      "marketingMemory",
      "designMemory",
    ] as const) {
      if (stripped[key] !== undefined) {
        removed.push(key);
        delete stripped[key];
      }
    }
    console.warn("[Research Run] Stripped invalid optional domain blocks", {
      removed,
      validationIssues,
    });
    return validateResearchPayload(stripped, context);
  }

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

export function parseResearchOutput(raw: string): ResearchOutput {
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

  const { normalized, adjustments } = normalizeResearchPayload(
    parsed as Record<string, unknown>,
  );

  if (adjustments.length > 0) {
    console.info("[Research Run] Normalized model output", { adjustments });
  }

  console.info("[Research Run] Parsed JSON (pre-validation):", JSON.stringify(normalized, null, 2));

  return validateResearchPayload(normalized, { rawResponse: raw, strippedJson });
}
