import type { ResearchReportType } from "@/brain/domains/reports";
import type { DesignConcept, ResearchCollection } from "@/agents/research/types";
import { coerceConceptField, normalizeDesignConcepts } from "@/agents/research/design-concept";

export interface DesignBriefSummary {
  collectionIdea: string;
  productSuggestions?: string[];
  recommendedProducts?: string[];
  recommendedColors?: string[];
  recommendedMaterials?: string[];
  recommendedPrintAreas?: string[];
  targetAudience?: string;
  styleDirection?: string;
  designs?: unknown[];
  trendScore?: number;
  competitorScore?: number;
  confidence?: number;
  rationale?: string;
  intelligenceMode?: "live" | "simulated";
}

export interface DesignReportResult {
  outputKind: "design";
  reportId: string;
  reportRecordId?: string;
  title: string;
  designs?: DesignConcept[];
  collection?: ResearchCollection;
  products?: string[];
  colors?: string[];
  materials?: string[];
  printAreas?: string[];
  rationale?: string;
  confidence?: number;
  savedDomains: string[];
  designBrief?: DesignBriefSummary;
}

export interface ResearchReportResult {
  outputKind: "research";
  reportId: string;
  reportRecordId?: string;
  title: string;
  executiveSummary?: string;
  keyFindings?: string[];
  opportunities?: string[];
  risks?: string[];
  recommendations?: string[];
  confidence?: number;
  reportType?: ResearchReportType;
  savedDomains: string[];
  designBrief?: DesignBriefSummary;
}

export type ResearchResult = ResearchReportResult | DesignReportResult;

export type ResearchRunPhase =
  | "idle"
  | "connecting"
  | "collecting"
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
  { id: "collecting", label: "Collecting signals" },
  { id: "competitors", label: "Analyzing competitors" },
  { id: "opportunities", label: "Building opportunities" },
  { id: "generating", label: "Generating report" },
  { id: "saving", label: "Saving to Brain" },
  { id: "handoff", label: "Preparing Design Studio handoff" },
];

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildDesignConceptContext(result: DesignReportResult) {
  const brief = result.designBrief;
  return {
    title: result.title,
    products:
      result.products ??
      brief?.recommendedProducts ??
      brief?.productSuggestions,
    colors: result.colors ?? brief?.recommendedColors,
    printAreas: result.printAreas ?? brief?.recommendedPrintAreas,
    styleDirection: brief?.styleDirection,
    targetAudience: brief?.targetAudience,
    collectionIdea: brief?.collectionIdea,
  };
}

function coerceFinalizedDesignConcepts(
  designs: unknown[] | undefined,
): DesignConcept[] {
  if (!Array.isArray(designs)) return [];

  return designs.filter(
    (entry): entry is DesignConcept =>
      Boolean(entry) &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof (entry as DesignConcept).designId === "string" &&
      typeof (entry as DesignConcept).title === "string" &&
      typeof (entry as DesignConcept).collectionRole === "string",
  );
}

function parseDesignConcepts(
  designs: unknown[] | undefined,
  result: DesignReportResult,
): DesignConcept[] {
  const finalized = coerceFinalizedDesignConcepts(designs);
  if (finalized.length > 0) {
    return finalized;
  }

  return (
    normalizeDesignConcepts(designs, buildDesignConceptContext(result)) ?? []
  );
}

export function parseResearchApiResponse(
  data: Record<string, unknown>,
): ResearchResult {
  const outputKind =
    data.outputKind === "design" || data.kind === "design"
      ? "design"
      : "research";

  const base = {
    reportId: String(data.reportId ?? ""),
    reportRecordId:
      typeof data.reportRecordId === "string"
        ? data.reportRecordId
        : undefined,
    title: coerceConceptField(data.title ?? "Research Report"),
    savedDomains: Array.isArray(data.savedDomains)
      ? data.savedDomains.map(String)
      : [],
    designBrief: data.designBrief as DesignBriefSummary | undefined,
    confidence:
      typeof data.confidence === "number" ? data.confidence : undefined,
  };

  if (outputKind === "design") {
    const designResult: DesignReportResult = {
      ...base,
      outputKind: "design",
      products: Array.isArray(data.products)
        ? data.products.map(String)
        : undefined,
      colors: Array.isArray(data.colors) ? data.colors.map(String) : undefined,
      materials: Array.isArray(data.materials)
        ? data.materials.map(String)
        : undefined,
      printAreas: Array.isArray(data.printAreas)
        ? data.printAreas.map(String)
        : undefined,
      rationale: asOptionalString(data.rationale),
      collection: data.collection as ResearchCollection | undefined,
      designs: [],
    };

    return {
      ...designResult,
      designs: parseDesignConcepts(
        Array.isArray(data.designs) ? data.designs : [],
        designResult,
      ),
    };
  }

  return {
    ...base,
    outputKind: "research",
    executiveSummary: asOptionalString(data.executiveSummary),
    keyFindings: Array.isArray(data.keyFindings)
      ? data.keyFindings.map(String)
      : [],
    opportunities: Array.isArray(data.opportunities)
      ? data.opportunities.map(String)
      : [],
    risks: Array.isArray(data.risks) ? data.risks.map(String) : [],
    recommendations: Array.isArray(data.recommendations)
      ? data.recommendations.map(String)
      : [],
    reportType: data.reportType as ResearchReportType | undefined,
  };
}
