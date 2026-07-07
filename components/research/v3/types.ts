export type {
  DesignBriefSummary,
  DesignReportResult,
  ResearchReportResult,
  ResearchResult,
} from "@/components/research/v2/types";
export { parseResearchApiResponse } from "@/components/research/v2/types";

export type ResearchRunPhase =
  | "idle"
  | "connecting"
  | "collecting"
  | "analyzing"
  | "competitors"
  | "opportunities"
  | "generating"
  | "saving"
  | "handoff"
  | "complete"
  | "error";

export const RESEARCH_RUN_STEPS: Array<{
  id: ResearchRunPhase;
  label: string;
}> = [
  { id: "connecting", label: "Connecting sources" },
  { id: "collecting", label: "Collecting live signals" },
  { id: "analyzing", label: "Analyzing market" },
  { id: "competitors", label: "Comparing competitors" },
  { id: "opportunities", label: "Building opportunities" },
  { id: "generating", label: "Generating report" },
  { id: "saving", label: "Saving to Brain" },
  { id: "handoff", label: "Preparing handoff" },
];

export interface ResearchRunError {
  message: string;
  stage?: string;
  sourceErrors?: string[];
}

export function parseResearchApiError(
  data: Record<string, unknown>,
): ResearchRunError {
  const message =
    typeof data.error === "string" ? data.error : "Research failed";
  const sourceErrors: string[] = [];

  const pushSourceError = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      sourceErrors.push(value.trim());
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const entry = value as Record<string, unknown>;
    const provider = entry.provider ?? entry.name ?? entry.id ?? entry.source;
    const detail = entry.message ?? entry.error ?? entry.reason;
    if (provider && detail) {
      sourceErrors.push(`${String(provider)}: ${String(detail)}`);
    } else if (provider) {
      sourceErrors.push(String(provider));
    } else if (detail) {
      sourceErrors.push(String(detail));
    }
  };

  if (Array.isArray(data.sourceErrors)) {
    data.sourceErrors.forEach(pushSourceError);
  }

  if (Array.isArray(data.failedProviders)) {
    data.failedProviders.forEach((provider) => {
      if (typeof provider === "string") sourceErrors.push(provider);
      else pushSourceError(provider);
    });
  }

  if (Array.isArray(data.connectors)) {
    data.connectors.forEach(pushSourceError);
  }

  if (data.details && typeof data.details === "object" && !Array.isArray(data.details)) {
    const details = data.details as Record<string, unknown>;
    if (Array.isArray(details.sourceErrors)) {
      details.sourceErrors.forEach(pushSourceError);
    }
    if (Array.isArray(details.failedProviders)) {
      details.failedProviders.forEach((provider) => {
        if (typeof provider === "string") sourceErrors.push(provider);
        else pushSourceError(provider);
      });
    }
  }

  return {
    message,
    stage: typeof data.stage === "string" ? data.stage : undefined,
    sourceErrors: sourceErrors.length > 0 ? sourceErrors : undefined,
  };
}
