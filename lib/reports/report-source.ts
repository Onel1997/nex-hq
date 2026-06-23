import type { BrainReportContent } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import type { AgentId } from "@/lib/constants/agents";

export type ReportSource = "live" | "seed" | "demo" | "legacy";

export type ReportAgentTab = "research" | "design" | "marketing" | "commerce" | "ceo";

export const REPORT_SOURCE_TAG_PREFIX = "report-source:";

export function reportSourceTag(source: ReportSource): string {
  return `${REPORT_SOURCE_TAG_PREFIX}${source}`;
}

export function parseReportSourceTag(tags: string[] | undefined): ReportSource | null {
  if (!tags) return null;
  for (const tag of tags) {
    if (tag.startsWith(REPORT_SOURCE_TAG_PREFIX)) {
      const value = tag.slice(REPORT_SOURCE_TAG_PREFIX.length);
      if (value === "live" || value === "seed" || value === "demo" || value === "legacy") {
        return value;
      }
    }
  }
  return null;
}

/** Research HQ pipeline reports include a design-brief handoff. */
export function isResearchHqPipelineReport(content: BrainReportContent): boolean {
  return Boolean(content.researchSections?.designBrief);
}

/** Infer report source from brain record metadata. */
export function inferBrainReportSource(
  record: BrainRecord<"reports">,
  content: BrainReportContent,
): ReportSource {
  const tagged = parseReportSourceTag(record.tags);
  if (tagged) return tagged;

  const createdBy = record.provenance?.createdBy;
  if (createdBy?.type === "system" && createdBy.id === "seed") {
    return "seed";
  }

  const tags = record.tags ?? [];
  const agentGenerated = tags.includes("agent-generated");

  if (createdBy?.type === "agent" && agentGenerated) {
    if (content.agentId === "research") {
      return tags.includes("design-brief-handoff") ||
        isResearchHqPipelineReport(content)
        ? "live"
        : "legacy";
    }
    return "live";
  }

  if (tags.includes("seed")) return "seed";
  if (tags.includes("demo")) return "demo";

  return "legacy";
}

export function agentTabForAgentId(agentId: AgentId): ReportAgentTab {
  switch (agentId) {
    case "research":
      return "research";
    case "designer":
    case "image":
      return "design";
    case "marketing":
    case "content":
      return "marketing";
    case "shopify":
      return "commerce";
    case "ceo":
      return "ceo";
    default:
      return "research";
  }
}

export const REPORT_AGENT_TAB_LABELS: Record<ReportAgentTab, string> = {
  research: "Research",
  design: "Design",
  marketing: "Marketing",
  commerce: "Commerce",
  ceo: "CEO",
};

export const REPORT_SOURCE_LABELS: Record<ReportSource, string> = {
  live: "Live",
  seed: "Seed",
  demo: "Demo",
  legacy: "Legacy",
};
