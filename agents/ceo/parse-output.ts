import { z } from "zod";
import { ceoOutputSchema, type CeoOutput } from "./types";

export const EXPECTED_CEO_SCHEMA = {
  title: "string (required)",
  reportType: '"ceo-report" (required)',
  executiveSummary: "string (required, min 80 chars)",
  keyInsights: "string[] (required, 3–10 items)",
  strategicOpportunities: "string[] (required, 2–8 items)",
  risks: "string[] (required, 2–8 items)",
  nextSteps:
    '{ action, priority: "high"|"medium"|"low", rationale? }[] (required, 3–10)',
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (required, min 1 — cited report titles)",
  fullBriefing: "string (required, min 600 chars, Markdown)",
} as const;

export class CeoParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly strippedJson?: string;
  readonly parsed?: unknown;
  readonly expectedSchema: typeof EXPECTED_CEO_SCHEMA;
  readonly receivedKeys?: string[];
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
    validationIssues?: CeoParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "CeoParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.strippedJson = params.strippedJson;
    this.parsed = params.parsed;
    this.expectedSchema = EXPECTED_CEO_SCHEMA;
    this.receivedKeys =
      params.parsed && typeof params.parsed === "object" && params.parsed !== null
        ? Object.keys(params.parsed as Record<string, unknown>)
        : undefined;
    this.validationIssues = params.validationIssues;
  }

  toLogPayload(): Record<string, unknown> {
    return {
      stage: this.stage,
      message: this.message,
      receivedKeys: this.receivedKeys,
      validationIssues: this.validationIssues,
      rawLength: this.rawResponse?.length,
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

    if (this.validationIssues?.length) {
      lines.push("", "Validation mismatches:");
      for (const issue of this.validationIssues) {
        lines.push(
          `  - ${issue.path}: ${issue.message} (expected: ${issue.expected}, received: ${JSON.stringify(issue.received)})`,
        );
      }
    }

    return lines.join("\n");
  }
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function normalizeCeoPayload(parsed: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...parsed };

  if (!normalized.reportType) {
    normalized.reportType = "ceo-report";
  }

  const aliasMap: Record<string, string> = {
    key_insights: "keyInsights",
    strategic_opportunities: "strategicOpportunities",
    strategicOpportunities: "strategicOpportunities",
    next_steps: "nextSteps",
    source_report_titles: "sourceReportTitles",
    full_briefing: "fullBriefing",
    executive_summary: "executiveSummary",
  };

  for (const [from, to] of Object.entries(aliasMap)) {
    if (normalized[from] !== undefined && normalized[to] === undefined) {
      normalized[to] = normalized[from];
    }
  }

  return normalized;
}

export function parseCeoOutput(raw: string): CeoOutput {
  const stripped = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new CeoParseError({
      message: "CEO-Antwort ist kein gültiges JSON.",
      stage: "json",
      rawResponse: raw,
      strippedJson: stripped,
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CeoParseError({
      message: "CEO-Antwort muss ein JSON-Objekt sein.",
      stage: "json",
      rawResponse: raw,
      strippedJson: stripped,
      parsed,
    });
  }

  const normalized = normalizeCeoPayload(parsed as Record<string, unknown>);
  const result = ceoOutputSchema.safeParse(normalized);

  if (!result.success) {
    const validationIssues = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      expected: issue.code,
      received: issue.path.reduce(
        (obj: unknown, key) =>
          obj && typeof obj === "object"
            ? (obj as Record<string, unknown>)[String(key)]
            : undefined,
        normalized,
      ),
      message: issue.message,
    }));

    throw new CeoParseError({
      message: "CEO-Antwort entspricht nicht dem erwarteten Schema.",
      stage: "validation",
      rawResponse: raw,
      strippedJson: stripped,
      parsed: normalized,
      validationIssues,
    });
  }

  return result.data;
}
