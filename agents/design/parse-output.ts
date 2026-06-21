import { z } from "zod";
import { enrichDesignPayload } from "./enrich-output";
import { designOutputSchema, type DesignOutput } from "./types";

export const EXPECTED_DESIGN_SCHEMA = {
  title: "string (required)",
  reportType: '"design-report" (required)',
  collectionName: "string (required)",
  season: "string (required)",
  theme: "string (required, min 8 chars)",
  story: "string (required, min 120 chars)",
  targetAudience: "string (required, min 40 chars)",
  colorPalette: '{ name, hex?, role }[] (required, 3–8)',
  materials: "string[] (required, 3–10)",
  silhouettes: "string[] (required, 3–10)",
  fits: "string[] (required, 2–8)",
  products:
    '{ name, category, fit, material, color, details, pricePosition, priority }[] (required, 4–14)',
  stylingDirection: "string (required, min 100 chars)",
  visualKeywords: "string[] (required, 3–12)",
  mockupIdeas: "string[] (required, 3–10)",
  campaignIdeas: "string[] (required, 3–8)",
  photographyStyle: "string (required, min 40 chars)",
  imagePrompts: "string[] (required, 2–8, min 40 chars each)",
  moodDescription: "string (required, min 60 chars)",
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (required, min 1)",
  fullConcept: "string (required, min 800 chars, Markdown)",
} as const;

export class DesignParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_DESIGN_SCHEMA;
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
    validationIssues?: DesignParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "DesignParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_DESIGN_SCHEMA;
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
  "collectionName",
  "season",
  "theme",
  "story",
  "targetAudience",
  "colorPalette",
  "materials",
  "silhouettes",
  "fits",
  "products",
  "stylingDirection",
  "visualKeywords",
  "mockupIdeas",
  "campaignIdeas",
  "photographyStyle",
  "imagePrompts",
  "moodDescription",
  "confidence",
  "sourceReportTitles",
  "fullConcept",
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

function normalizeDesignPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const normalized = { ...parsed };
  const adjustments: string[] = [];

  if (!normalized.reportType) {
    normalized.reportType = "design-report";
    adjustments.push("set reportType");
  }

  const aliasMap: Record<string, string> = {
    collection_name: "collectionName",
    collection_story: "story",
    story: "story",
    color_palette: "colorPalette",
    product_lineup: "products",
    products: "products",
    styling_direction: "stylingDirection",
    design_direction: "stylingDirection",
    visual_keywords: "visualKeywords",
    mockup_ideas: "mockupIdeas",
    campaign_ideas: "campaignIdeas",
    launch_recommendations: "campaignIdeas",
    target_audience: "targetAudience",
    photography_style: "photographyStyle",
    image_prompts: "imagePrompts",
    mood_description: "moodDescription",
    source_report_titles: "sourceReportTitles",
    full_concept: "fullConcept",
    concept: "fullConcept",
    briefing: "fullConcept",
    hero_products: "products",
  };

  for (const [from, to] of Object.entries(aliasMap)) {
    if (normalized[from] !== undefined && normalized[to] === undefined) {
      normalized[to] = normalized[from];
      adjustments.push(`alias ${from} -> ${to}`);
    }
  }

  if (normalized.collectionStory && !normalized.story) {
    normalized.story = normalized.collectionStory;
    adjustments.push("alias collectionStory -> story");
  }

  if (normalized.designDirection && !normalized.stylingDirection) {
    normalized.stylingDirection = normalized.designDirection;
    adjustments.push("alias designDirection -> stylingDirection");
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

function validateDesignPayload(
  parsed: Record<string, unknown>,
  context: { rawResponse: string; strippedJson: string },
): DesignOutput {
  let result = designOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  const enrichAdjustments = enrichDesignPayload(parsed);
  if (enrichAdjustments.length > 0) {
    console.info("[Design Parse] Re-enriched payload after validation issues", {
      adjustments: enrichAdjustments,
    });
    result = designOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  const missingFields = findMissingRequiredFields(parsed);
  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  console.error("[Design Parse] Validation failed", {
    missingFields,
    validationIssues,
    parsedJson: JSON.stringify(parsed, null, 2),
    rawResponsePreview: context.rawResponse.slice(0, 4000),
  });

  throw new DesignParseError({
    message: `Schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed,
    missingFields,
    validationIssues,
  });
}

export function parseDesignOutput(raw: string): DesignOutput {
  console.info("[Design Parse] Raw response:", raw);

  const strippedJson = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(strippedJson);
  } catch (jsonError) {
    console.error("[Design Parse] JSON parse failed", {
      error: jsonError instanceof Error ? jsonError.message : jsonError,
      strippedJsonPreview: strippedJson.slice(0, 2000),
    });
    throw new DesignParseError({
      message: `JSON parse failed: ${jsonError instanceof Error ? jsonError.message : "unknown error"}`,
      stage: "json",
      rawResponse: raw,
      strippedJson,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DesignParseError({
      message: "Parsed response is not a JSON object",
      stage: "validation",
      rawResponse: raw,
      strippedJson,
      parsed,
    });
  }

  const { normalized, adjustments: normalizeAdjustments } = normalizeDesignPayload(
    parsed as Record<string, unknown>,
  );
  const enrichAdjustments = enrichDesignPayload(normalized);
  const allAdjustments = [...normalizeAdjustments, ...enrichAdjustments];

  if (allAdjustments.length > 0) {
    console.info("[Design Parse] Normalized model output", {
      adjustments: allAdjustments,
    });
  }

  console.info(
    "[Design Parse] Parsed JSON (pre-validation):",
    JSON.stringify(normalized, null, 2),
  );

  return validateDesignPayload(normalized, { rawResponse: raw, strippedJson });
}
