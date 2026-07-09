import { z } from "zod";
import {
  ceoFinalOutputSchema,
  type CeoFinalOutput,
} from "./final-report-types";

export class CeoFinalParseError extends Error {
  readonly stage: "json" | "validation";
  readonly rawResponse?: string;
  readonly validationIssues?: Array<{ path: string; message: string }>;

  constructor(params: {
    message: string;
    stage: "json" | "validation";
    rawResponse?: string;
    validationIssues?: CeoFinalParseError["validationIssues"];
  }) {
    super(params.message);
    this.name = "CeoFinalParseError";
    this.stage = params.stage;
    this.rawResponse = params.rawResponse;
    this.validationIssues = params.validationIssues;
  }
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export function parseCeoFinalOutput(raw: string): CeoFinalOutput {
  const stripped = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new CeoFinalParseError({
      message: "CEO-Final-Antwort ist kein gültiges JSON.",
      stage: "json",
      rawResponse: raw,
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CeoFinalParseError({
      message: "CEO-Final-Antwort muss ein JSON-Objekt sein.",
      stage: "json",
      rawResponse: raw,
    });
  }

  const normalized = { ...(parsed as Record<string, unknown>) };
  if (!normalized.reportType) {
    normalized.reportType = "ceo-final-report";
  }

  const result = ceoFinalOutputSchema.safeParse(normalized);
  if (!result.success) {
    throw new CeoFinalParseError({
      message: "CEO-Final-Antwort entspricht nicht dem erwarteten Schema.",
      stage: "validation",
      rawResponse: raw,
      validationIssues: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    });
  }

  return result.data;
}
