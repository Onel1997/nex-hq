import { z } from "zod";
import { enrichContentPayload } from "./enrich-output";
import { contentOutputSchema, type ContentOutput } from "./types";

export const EXPECTED_CONTENT_SCHEMA = {
  title: "string (required)",
  reportType: '"content-report" (required)',
  brandNarrative: "string (required, min 120 chars)",
  landingPageCopy:
    "{ heroHeadline, heroSubheadline, brandStory, collectionIntroduction, cta }",
  productCopy:
    "{ productName, shortDescription, longDescription, featureBullets[], seoCopy }[] (1–24)",
  emailSequence:
    "{ teaserEmail, revealEmail, countdownEmail, launchEmail }",
  socialContent:
    "{ instagramCaptions[10–20], tiktokHooks[10–20], storyIdeas[5–15], launchPosts[4–10] }",
  smsCampaign: "{ teaserSms, countdownSms, launchSms }",
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (required, min 1)",
  fullContent: "string (required, min 800 chars, Markdown)",
} as const;

export class ContentParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_CONTENT_SCHEMA;
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
    validationIssues?: ContentParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "ContentParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_CONTENT_SCHEMA;
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
  "brandNarrative",
  "landingPageCopy",
  "productCopy",
  "emailSequence",
  "socialContent",
  "smsCampaign",
  "confidence",
  "sourceReportTitles",
  "fullContent",
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

function normalizeContentPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const normalized = { ...parsed };
  const adjustments: string[] = [];

  if (!normalized.reportType) {
    normalized.reportType = "content-report";
    adjustments.push("set reportType");
  }

  const aliasMap: Record<string, string> = {
    brand_narrative: "brandNarrative",
    landing_page_copy: "landingPageCopy",
    product_copy: "productCopy",
    email_sequence: "emailSequence",
    social_content: "socialContent",
    sms_campaign: "smsCampaign",
    source_report_titles: "sourceReportTitles",
    full_content: "fullContent",
    full_plan: "fullContent",
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

function validateContentPayload(
  parsed: Record<string, unknown>,
  context: { rawResponse: string; strippedJson: string },
): ContentOutput {
  let result = contentOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  const enrichAdjustments = enrichContentPayload(parsed);
  if (enrichAdjustments.length > 0) {
    console.info("[Content Parse] Re-enriched payload after validation issues", {
      adjustments: enrichAdjustments,
    });
    result = contentOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  const missingFields = findMissingRequiredFields(parsed);
  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  console.error("[Content Parse] Validation failed", {
    missingFields,
    validationIssues,
    parsedJson: JSON.stringify(parsed, null, 2),
    rawResponsePreview: context.rawResponse.slice(0, 4000),
  });

  throw new ContentParseError({
    message: `Schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed,
    missingFields,
    validationIssues,
  });
}

export function parseContentOutput(raw: string): ContentOutput {
  console.info("[Content Parse] Raw response:", raw);

  const strippedJson = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(strippedJson);
  } catch (jsonError) {
    console.error("[Content Parse] JSON parse failed", {
      error: jsonError instanceof Error ? jsonError.message : jsonError,
      strippedJsonPreview: strippedJson.slice(0, 2000),
    });
    throw new ContentParseError({
      message: `JSON parse failed: ${jsonError instanceof Error ? jsonError.message : "unknown error"}`,
      stage: "json",
      rawResponse: raw,
      strippedJson,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ContentParseError({
      message: "Parsed response is not a JSON object",
      stage: "validation",
      rawResponse: raw,
      strippedJson,
      parsed,
    });
  }

  const { normalized, adjustments: normalizeAdjustments } =
    normalizeContentPayload(parsed as Record<string, unknown>);
  const enrichAdjustments = enrichContentPayload(normalized);
  const allAdjustments = [...normalizeAdjustments, ...enrichAdjustments];

  if (allAdjustments.length > 0) {
    console.info("[Content Parse] Normalized model output", {
      adjustments: allAdjustments,
    });
  }

  console.info(
    "[Content Parse] Parsed JSON (pre-validation):",
    JSON.stringify(normalized, null, 2),
  );

  return validateContentPayload(normalized, { rawResponse: raw, strippedJson });
}
