import { z } from "zod";
import { enrichMarketingPayload } from "./enrich-output";
import { marketingOutputSchema, type MarketingOutput } from "./types";

export const EXPECTED_MARKETING_SCHEMA = {
  title: "string (required)",
  reportType: '"marketing-report" (required)',
  launchStrategy: "string (required, min 100 chars)",
  contentPillars: "string[] (required, 3–8)",
  tiktokIdeas: "string[] (required, exactly 20)",
  instagramIdeas: "string[] (required, exactly 20)",
  influencerStrategy: "string (required, min 80 chars)",
  emailCampaignPlan: "{ phase, subject, objective, content }[] (3–8)",
  communityBuildingPlan: "string (required, min 80 chars)",
  contentCalendar30Day: "{ day, title, channel, format, description }[] (exactly 30)",
  launchKpis: "{ metric, target, rationale }[] (4–12)",
  budgetAllocation: "{ category, allocation, rationale }[] (4–10)",
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (required, min 1)",
  fullPlan: "string (required, min 800 chars, Markdown)",
} as const;

export class MarketingParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_MARKETING_SCHEMA;
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
    validationIssues?: MarketingParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "MarketingParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_MARKETING_SCHEMA;
    this.receivedKeys =
      params.parsed && typeof params.parsed === "object" && params.parsed !== null
        ? Object.keys(params.parsed as Record<string, unknown>)
        : undefined;
    this.missingFields = params.missingFields;
    this.validationIssues = params.validationIssues;
  }

  toLogPayload(): Record<string, unknown> {
    return {
      stage: this.stage,
      message: this.message,
      expectedSchema: this.expectedSchema,
      receivedKeys: this.receivedKeys,
      missingFields: this.missingFields,
      validationIssues: this.validationIssues,
      rawResponseLength: this.rawResponse?.length,
      rawResponsePreview: this.rawResponse?.slice(0, 4000),
      strippedJsonPreview: this.strippedJson?.slice(0, 4000),
      parsed: this.parsed,
    };
  }

  toDetailedMessage(): string {
    const lines = [
      this.message,
      "",
      "Expected schema:",
      JSON.stringify(this.expectedSchema, null, 2),
    ];

    if (this.receivedKeys) {
      lines.push(
        "",
        `Received top-level keys: [${this.receivedKeys.join(", ")}]`,
      );
    }

    if (this.missingFields?.length) {
      lines.push("", `Missing fields: [${this.missingFields.join(", ")}]`);
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
      lines.push("", "Parsed JSON:", JSON.stringify(this.parsed, null, 2));
    }

    if (this.rawResponse) {
      lines.push("", "Raw response:", this.rawResponse);
    }

    return lines.join("\n");
  }
}

const REQUIRED_TOP_LEVEL_FIELDS = [
  "title",
  "reportType",
  "launchStrategy",
  "contentPillars",
  "tiktokIdeas",
  "instagramIdeas",
  "influencerStrategy",
  "emailCampaignPlan",
  "communityBuildingPlan",
  "contentCalendar30Day",
  "launchKpis",
  "budgetAllocation",
  "confidence",
  "sourceReportTitles",
  "fullPlan",
] as const;

function stripJsonFences(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced) return fenced[1].trim();

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

function normalizeMarketingPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const normalized = { ...parsed };
  const adjustments: string[] = [];

  if (!normalized.reportType) {
    normalized.reportType = "marketing-report";
    adjustments.push("set reportType");
  }

  const aliasMap: Record<string, string> = {
    launch_strategy: "launchStrategy",
    content_pillars: "contentPillars",
    tiktok_ideas: "tiktokIdeas",
    instagram_ideas: "instagramIdeas",
    influencer_strategy: "influencerStrategy",
    email_campaign_plan: "emailCampaignPlan",
    community_building_plan: "communityBuildingPlan",
    content_calendar_30_day: "contentCalendar30Day",
    content_calendar: "contentCalendar30Day",
    launch_kpis: "launchKpis",
    budget_allocation: "budgetAllocation",
    source_report_titles: "sourceReportTitles",
    full_plan: "fullPlan",
  };

  for (const [from, to] of Object.entries(aliasMap)) {
    if (normalized[from] !== undefined && normalized[to] === undefined) {
      normalized[to] = normalized[from];
      adjustments.push(`alias ${from} -> ${to}`);
    }
  }

  if (typeof normalized.confidence === "string") {
    const parsedConfidence = Number(normalized.confidence);
    if (!Number.isNaN(parsedConfidence)) {
      normalized.confidence = parsedConfidence;
      adjustments.push("coerced confidence to number");
    }
  }

  return { normalized, adjustments };
}

function validateMarketingPayload(
  parsed: Record<string, unknown>,
  context: { rawResponse: string; strippedJson: string },
): MarketingOutput {
  let result = marketingOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  const enrichAdjustments = enrichMarketingPayload(parsed);
  if (enrichAdjustments.length > 0) {
    console.info("[Marketing Parse] Re-enriched payload after validation issues", {
      adjustments: enrichAdjustments,
    });
    result = marketingOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  const missingFields = findMissingRequiredFields(parsed);
  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  console.error("[Marketing Parse] Validation failed", {
    missingFields,
    validationIssues,
    parsedJson: JSON.stringify(parsed, null, 2),
    rawResponsePreview: context.rawResponse.slice(0, 4000),
  });

  throw new MarketingParseError({
    message: `Schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed,
    missingFields,
    validationIssues,
  });
}

export function parseMarketingOutput(raw: string): MarketingOutput {
  console.info("[Marketing Parse] Raw response:", raw);

  const strippedJson = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(strippedJson);
  } catch (jsonError) {
    console.error("[Marketing Parse] JSON parse failed", {
      error: jsonError instanceof Error ? jsonError.message : jsonError,
      strippedJsonPreview: strippedJson.slice(0, 2000),
    });
    throw new MarketingParseError({
      message: `JSON parse failed: ${jsonError instanceof Error ? jsonError.message : "unknown error"}`,
      stage: "json",
      rawResponse: raw,
      strippedJson,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MarketingParseError({
      message: "Parsed response is not a JSON object",
      stage: "validation",
      rawResponse: raw,
      strippedJson,
      parsed,
    });
  }

  const { normalized, adjustments: normalizeAdjustments } =
    normalizeMarketingPayload(parsed as Record<string, unknown>);
  const enrichAdjustments = enrichMarketingPayload(normalized);
  const allAdjustments = [...normalizeAdjustments, ...enrichAdjustments];

  if (allAdjustments.length > 0) {
    console.info("[Marketing Parse] Normalized model output", {
      adjustments: allAdjustments,
    });
  }

  console.info(
    "[Marketing Parse] Parsed JSON (pre-validation):",
    JSON.stringify(normalized, null, 2),
  );

  return validateMarketingPayload(normalized, { rawResponse: raw, strippedJson });
}
