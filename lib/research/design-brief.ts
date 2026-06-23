import "server-only";

import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainReportContent } from "@/brain/domains/reports";
import type { ResearchDesignBrief } from "@/lib/research/types";
import { generateDesignBrief } from "@/services/designBriefEngine";
import { loadResearchIntelligence } from "@/services/researchEngine";

/** Format design brief as Design Studio prefill text. */
export function formatDesignBriefForStudio(brief: ResearchDesignBrief): string {
  const colors = brief.colorPalette.map((c) => c.name).join(", ");
  const products = brief.productSuggestions.join(", ");

  return [
    `Kollektion: ${brief.collectionIdea}`,
    `Priorität: ${brief.priority ?? "high"}`,
    `Zielgruppe: ${brief.targetAudience}`,
    `Stil: ${brief.styleDirection}`,
    `Silhouetten: ${brief.silhouettes.join(", ")}`,
    `Farbpalette: ${colors}`,
    `Produkte: ${products}`,
    brief.designs?.length ? `Designs: ${brief.designs.join(", ")}` : "",
    `Scores — Potential: ${brief.confidence}% · Trend: ${brief.trendScore}% · Konkurrenz: ${brief.competitorScore}%`,
    "",
    brief.rationale,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractDesignBriefFromRecord(
  content: BrainReportContent,
): ResearchDesignBrief | null {
  const brief = content.researchSections?.designBrief;
  if (!brief) return null;
  return {
    ...brief,
    sourceReportId: content.reportId,
  };
}

/** Load the latest research design brief from Brain, or generate from live intelligence. */
export async function loadLatestDesignBrief(
  reportId?: string,
): Promise<{ brief: ResearchDesignBrief; prefill: string; source: "brain" | "live" }> {
  try {
    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();

    if (reportId) {
      const result = await brain.searchRecords({
        workspaceId: workspace.id,
        domains: ["reports"],
        limit: 1,
      });
      const match = result.records.find(
        (r) => (r.content as BrainReportContent).reportId === reportId,
      );
      if (match) {
        const brief = extractDesignBriefFromRecord(
          match.content as BrainReportContent,
        );
        if (brief) {
          return { brief, prefill: formatDesignBriefForStudio(brief), source: "brain" };
        }
      }
    }

    const result = await brain.searchRecords({
      workspaceId: workspace.id,
      domains: ["reports"],
      tags: ["design-brief-handoff"],
      limit: 5,
    });

    for (const record of result.records) {
      const content = record.content as BrainReportContent;
      if (content.agentId !== "research") continue;
      const brief = extractDesignBriefFromRecord(content);
      if (brief) {
        return { brief, prefill: formatDesignBriefForStudio(brief), source: "brain" };
      }
    }
  } catch (error) {
    console.warn("[Design Brief] Brain load failed, using live intelligence", error);
  }

  const intelligence = await loadResearchIntelligence();
  const brief = generateDesignBrief({ intelligence });
  return {
    brief,
    prefill: formatDesignBriefForStudio(brief),
    source: "live",
  };
}
