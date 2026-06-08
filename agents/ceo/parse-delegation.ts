import { z } from "zod";
import {
  ceoDelegationOutputSchema,
  type CeoDelegationOutput,
} from "./delegation-types";

export const EXPECTED_DELEGATION_SCHEMA = {
  title: "string (required)",
  objective: "string (required, min 40 chars)",
  milestones: "string[] (required, 2–8 items)",
  taskPlan:
    '{ title, description, assigneeAgentId, priority, domain? }[] (required, 3–20)',
  confidence: "number 0–1 (required)",
  sourceReportTitles: "string[] (optional)",
  rationale: "string (optional)",
} as const;

export class CeoDelegationParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly validationIssues?: Array<{
    path: string;
    message: string;
  }>;

  constructor(params: {
    message: string;
    stage: "json" | "validation";
    rawResponse?: string;
    validationIssues?: CeoDelegationParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "CeoDelegationParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.validationIssues = params.validationIssues;
  }

  toLogPayload(): Record<string, unknown> {
    return {
      stage: this.stage,
      message: this.message,
      validationIssues: this.validationIssues,
      rawLength: this.rawResponse?.length,
    };
  }
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function normalizeDelegationPayload(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...parsed };

  const aliasMap: Record<string, string> = {
    task_plan: "taskPlan",
    source_report_titles: "sourceReportTitles",
  };

  for (const [from, to] of Object.entries(aliasMap)) {
    if (normalized[from] !== undefined && normalized[to] === undefined) {
      normalized[to] = normalized[from];
    }
  }

  if (!normalized.sourceReportTitles) {
    normalized.sourceReportTitles = [];
  }

  return normalized;
}

export function parseDelegationOutput(raw: string): CeoDelegationOutput {
  const stripped = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new CeoDelegationParseError({
      message: "Delegations-Antwort ist kein gültiges JSON.",
      stage: "json",
      rawResponse: raw,
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CeoDelegationParseError({
      message: "Delegations-Antwort muss ein JSON-Objekt sein.",
      stage: "json",
      rawResponse: raw,
    });
  }

  const normalized = normalizeDelegationPayload(parsed as Record<string, unknown>);
  const result = ceoDelegationOutputSchema.safeParse(normalized);

  if (!result.success) {
    const validationIssues = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));

    throw new CeoDelegationParseError({
      message: "Delegations-Antwort entspricht nicht dem erwarteten Schema.",
      stage: "validation",
      rawResponse: raw,
      validationIssues,
    });
  }

  return result.data;
}
