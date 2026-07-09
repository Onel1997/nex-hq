export type {
  DesignBriefSummary,
  DesignReportResult,
  ResearchReportResult,
  ResearchResult,
} from "@/components/research/v2/types";
export { parseResearchApiResponse } from "@/components/research/v2/types";

export type { ResearchStudioReport } from "@/lib/research-intelligence/report";

export type ResearchResultV3 = import("@/components/research/v2/types").ResearchResult & {
  fusionReport?: import("@/lib/research-intelligence/report").ResearchStudioReport | null;
};

export type ResearchRunPhase =
  | "idle"
  | "engine"
  | "syncing"
  | "normalizing"
  | "fusing"
  | "scoring"
  | "recommendations"
  | "building"
  | "complete"
  | "error";

export const RESEARCH_RUN_STEPS: Array<{
  id: ResearchRunPhase;
  label: string;
}> = [
  { id: "engine", label: "Running research engine" },
  { id: "syncing", label: "Syncing data sources" },
  { id: "normalizing", label: "Normalizing signals" },
  { id: "fusing", label: "Fusing intelligence" },
  { id: "scoring", label: "Scoring confidence" },
  { id: "recommendations", label: "Generating recommendations" },
  { id: "building", label: "Building report" },
];

export interface ResearchRunError {
  message: string;
  stage?: string;
  sourceErrors?: string[];
  missingFields?: string[];
  validationIssues?: Array<{
    path: string;
    expected: string;
    received: unknown;
    message: string;
  }>;
}

export interface FusionReportError {
  message: string;
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

  const validationIssues = parseValidationIssues(data.validationIssues);
  const missingFields = Array.isArray(data.missingFields)
    ? data.missingFields.map(String)
    : undefined;

  return {
    message,
    stage: typeof data.stage === "string" ? data.stage : undefined,
    sourceErrors: sourceErrors.length > 0 ? sourceErrors : undefined,
    missingFields,
    validationIssues,
  };
}

function parseValidationIssues(
  value: unknown,
): ResearchRunError["validationIssues"] {
  if (!Array.isArray(value)) return undefined;

  const issues = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const issue = entry as Record<string, unknown>;
      const path = typeof issue.path === "string" ? issue.path : "(root)";
      const message =
        typeof issue.message === "string" ? issue.message : "Invalid value";
      const expected =
        typeof issue.expected === "string" ? issue.expected : "schema constraint";
      return {
        path,
        message,
        expected,
        received: issue.received,
      };
    })
    .filter((issue): issue is NonNullable<typeof issue> => issue !== null);

  return issues.length > 0 ? issues : undefined;
}

export function parseFusionReportResponse(
  data: Record<string, unknown>,
): import("@/lib/research-intelligence/report").ResearchStudioReport | null {
  if (!data.ok || !data.report || typeof data.report !== "object") return null;
  return data.report as import("@/lib/research-intelligence/report").ResearchStudioReport;
}
