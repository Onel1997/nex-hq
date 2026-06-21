import { z } from "zod";
import { buildV3ImageOutput, type EnrichStudioOptions } from "./enrich-studio";
import { imageOutputSchema, type ImageOutput } from "./types";

export interface ParseImageOutputOptions extends EnrichStudioOptions {}

export const EXPECTED_IMAGE_SCHEMA = {
  title: "string (required)",
  reportType: '"image-project" (required)',
  schemaVersion: '"3.0" (required)',
  projectName: "string (required)",
  collectionName: "string (required)",
  visualDirection: "string min 80 chars",
  moodboard: "{ visualDirection, aestheticKeywords, colorSystem, materialReferences, photographyStyle }",
  palette: "{ primary, secondary, accent, background, text } — Name + HEX",
  productionAssets:
    "{ assetType, productName, collection, color, material, location, lighting, photographyStyle, cameraStyle, prompt, priority }[] (18–48)",
  lookbookShots: "{ shotName, models, location, outfitProducts, styling, purpose }[] (4–12)",
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (required, min 1)",
  fullProject: "string (required, min 600 chars, Markdown)",
} as const;

export class ImageParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_IMAGE_SCHEMA;
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
    validationIssues?: ImageParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "ImageParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_IMAGE_SCHEMA;
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
  "projectName",
  "collectionName",
  "visualDirection",
  "moodboard",
  "palette",
  "productionAssets",
  "lookbookShots",
  "confidence",
  "sourceReportTitles",
  "fullProject",
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

function normalizeImagePayload(
  parsed: Record<string, unknown>,
): { normalized: Record<string, unknown>; adjustments: string[] } {
  const normalized = { ...parsed };
  const adjustments: string[] = [];

  if (
    !normalized.reportType ||
    normalized.reportType === "image-report" ||
    normalized.reportType === "image_report"
  ) {
    normalized.reportType = "image-project";
    adjustments.push("set reportType=image-project");
  }

  const aliasMap: Record<string, string> = {
    project_name: "projectName",
    collection_name: "collectionName",
    visual_direction: "visualDirection",
    production_assets: "productionAssets",
    lookbook_shots: "lookbookShots",
    core_package: "corePackage",
    advanced_package: "advancedPackage",
    campaign_shots: "campaignShots",
    source_report_titles: "sourceReportTitles",
    full_project: "fullProject",
    schema_version: "schemaVersion",
  };

  for (const [from, to] of Object.entries(aliasMap)) {
    if (normalized[from] !== undefined && normalized[to] === undefined) {
      normalized[to] = normalized[from];
      adjustments.push(`alias ${from} -> ${to}`);
    }
  }

  if (!normalized.title && normalized.projectName) {
    normalized.title = normalized.projectName;
  }
  if (!normalized.projectName && normalized.title) {
    normalized.projectName = normalized.title;
  }

  if (typeof normalized.confidence === "string") {
    const parsedConfidence = Number(normalized.confidence);
    if (!Number.isNaN(parsedConfidence)) {
      normalized.confidence = parsedConfidence;
    }
  }

  return { normalized, adjustments };
}

function validateImagePayload(
  parsed: Record<string, unknown>,
  context: { rawResponse: string; strippedJson: string },
  options?: ParseImageOutputOptions,
): ImageOutput {
  const v3Payload = buildV3ImageOutput(parsed, options);
  const result = imageOutputSchema.safeParse(v3Payload);

  if (result.success) {
    return result.data;
  }

  console.error("IMAGE PROJECT VALIDATION ERRORS", result.error.flatten());

  const missingFields = findMissingRequiredFields(v3Payload);
  const validationIssues = result.error.issues.map((issue) =>
    zodIssueToDetail(issue, v3Payload),
  );

  throw new ImageParseError({
    message: `Schema validation failed with ${result.error.issues.length} issue(s)`,
    stage: "validation",
    rawResponse: context.rawResponse,
    strippedJson: context.strippedJson,
    parsed: v3Payload,
    missingFields,
    validationIssues,
  });
}

export function parseImageOutput(
  raw: string,
  options?: ParseImageOutputOptions,
): ImageOutput {
  const strippedJson = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(strippedJson);
  } catch (jsonError) {
    throw new ImageParseError({
      message: `JSON parse failed: ${jsonError instanceof Error ? jsonError.message : "unknown error"}`,
      stage: "json",
      rawResponse: raw,
      strippedJson,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ImageParseError({
      message: "Parsed response is not a JSON object",
      stage: "validation",
      rawResponse: raw,
      strippedJson,
      parsed,
    });
  }

  const { normalized, adjustments: normalizeAdjustments } =
    normalizeImagePayload(parsed as Record<string, unknown>);

  if (normalizeAdjustments.length > 0) {
    console.info("[Image Parse] Normalized model output aliases", {
      adjustments: normalizeAdjustments,
    });
  }

  return validateImagePayload(normalized, { rawResponse: raw, strippedJson }, options);
}
