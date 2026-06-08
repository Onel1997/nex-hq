import { z } from "zod";
import { enrichShopifyPayload } from "./enrich-output";
import { shopifyOutputSchema, type ShopifyOutput } from "./types";

export const EXPECTED_SHOPIFY_SCHEMA = {
  title: "string (required)",
  reportType: '"shopify-report" (required)',
  collectionName: "string (required)",
  collectionDescription: "string (required, min 80 chars)",
  collectionSeoTitle: "string (required, 10–70 chars)",
  collectionSeoDescription: "string (required, 50–320 chars)",
  products:
    "{ productName, productType, category, description, shortDescription, materials, tags[], seoTitle, seoDescription, suggestedPrice, compareAtPrice?, variants[], inventoryRecommendation }[] (1–24)",
  collectionsToCreate: "string[] (1–8)",
  navigationRecommendations: "string[] (2–10)",
  homepageRecommendations: "string[] (2–10)",
  launchChecklist: "string[] (4–16)",
  storefrontWarnings: "string[] (1–8)",
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (required, min 1)",
  fullDraft: "string (required, min 800 chars, Markdown)",
} as const;

export class ShopifyParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_SHOPIFY_SCHEMA;
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
    validationIssues?: ShopifyParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "ShopifyParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_SHOPIFY_SCHEMA;
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
  "collectionDescription",
  "collectionSeoTitle",
  "collectionSeoDescription",
  "products",
  "collectionsToCreate",
  "navigationRecommendations",
  "homepageRecommendations",
  "launchChecklist",
  "storefrontWarnings",
  "confidence",
  "sourceReportTitles",
  "fullDraft",
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

function normalizeShopifyPayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const normalized = { ...parsed };
  const adjustments: string[] = [];

  if (!normalized.reportType) {
    normalized.reportType = "shopify-report";
    adjustments.push("set reportType");
  }

  const aliasMap: Record<string, string> = {
    collection_name: "collectionName",
    collection_description: "collectionDescription",
    collection_seo_title: "collectionSeoTitle",
    collection_seo_description: "collectionSeoDescription",
    collections_to_create: "collectionsToCreate",
    navigation_recommendations: "navigationRecommendations",
    homepage_recommendations: "homepageRecommendations",
    launch_checklist: "launchChecklist",
    storefront_warnings: "storefrontWarnings",
    source_report_titles: "sourceReportTitles",
    full_draft: "fullDraft",
    full_plan: "fullDraft",
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

function validateShopifyPayload(
  parsed: Record<string, unknown>,
  context: { rawResponse: string; strippedJson: string },
): ShopifyOutput {
  let result = shopifyOutputSchema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  const enrichAdjustments = enrichShopifyPayload(parsed);
  if (enrichAdjustments.length > 0) {
    console.info("[Shopify Parse] Re-enriched payload after validation issues", {
      adjustments: enrichAdjustments,
    });
    result = shopifyOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  const missingFields = findMissingRequiredFields(parsed);
  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, parsed),
  );

  console.error("[Shopify Parse] Validation failed", {
    missingFields,
    validationIssues,
    parsedJson: JSON.stringify(parsed, null, 2),
    rawResponsePreview: context.rawResponse.slice(0, 4000),
  });

  throw new ShopifyParseError({
    message: `Schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed,
    missingFields,
    validationIssues,
  });
}

export function parseShopifyOutput(raw: string): ShopifyOutput {
  console.info("[Shopify Parse] Raw response:", raw);

  const strippedJson = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(strippedJson);
  } catch (jsonError) {
    console.error("[Shopify Parse] JSON parse failed", {
      error: jsonError instanceof Error ? jsonError.message : jsonError,
      strippedJsonPreview: strippedJson.slice(0, 2000),
    });
    throw new ShopifyParseError({
      message: `JSON parse failed: ${jsonError instanceof Error ? jsonError.message : "unknown error"}`,
      stage: "json",
      rawResponse: raw,
      strippedJson,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ShopifyParseError({
      message: "Parsed response is not a JSON object",
      stage: "validation",
      rawResponse: raw,
      strippedJson,
      parsed,
    });
  }

  const { normalized, adjustments: normalizeAdjustments } =
    normalizeShopifyPayload(parsed as Record<string, unknown>);
  const enrichAdjustments = enrichShopifyPayload(normalized);
  const allAdjustments = [...normalizeAdjustments, ...enrichAdjustments];

  if (allAdjustments.length > 0) {
    console.info("[Shopify Parse] Normalized model output", {
      adjustments: allAdjustments,
    });
  }

  console.info(
    "[Shopify Parse] Parsed JSON (pre-validation):",
    JSON.stringify(normalized, null, 2),
  );

  return validateShopifyPayload(normalized, { rawResponse: raw, strippedJson });
}
