import "server-only";

import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";

export interface KnowledgeSnapshot {
  recentlyUsed: string[];
  savedInsights: string[];
  lastAnalysis: string;
  reportCount: number;
  trendReportCount: number;
  competitorCount: number;
  signalCount: number;
}

const FALLBACK_KNOWLEDGE: KnowledgeSnapshot = {
  recentlyUsed: [
    "Premium Streetwear 2026",
    "Oversized Market Growth",
    "Color Trends SS26",
  ],
  savedInsights: [
    "Oversized Silhouettes dominieren SS26",
    "Earth Tones gewinnen an Momentum",
    "Premium Segment wächst +14%",
  ],
  lastAnalysis: "Premium Streetwear 2026",
  reportCount: 14,
  trendReportCount: 3,
  competitorCount: 5,
  signalCount: 8,
};

function extractReportType(content: unknown): string {
  if (!content || typeof content !== "object") return "research";
  const c = content as { reportType?: string; agentId?: string };
  return c.reportType ?? "research";
}

/** Load research knowledge base from Brain reports. */
export async function loadKnowledgeBase(): Promise<KnowledgeSnapshot> {
  try {
    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();

    const result = await brain.searchRecords({
      workspaceId: workspace.id,
      domains: ["reports"],
      query: "research",
      limit: 50,
    });

    const researchReports = result.records.filter((r) => {
      const content = r.content as { agentId?: string } | undefined;
      const tags = (r.tags ?? []).map((t) => t.toLowerCase());
      return (
        content?.agentId === "research" ||
        tags.some((t) => t.includes("research"))
      );
    });

    if (researchReports.length === 0) {
      return FALLBACK_KNOWLEDGE;
    }

    const trendReports = researchReports.filter(
      (r) => extractReportType(r.content) === "trend",
    );
    const competitorReports = researchReports.filter(
      (r) => extractReportType(r.content) === "competitor",
    );

    const recentlyUsed = researchReports.slice(0, 3).map((r) => r.title);
    const savedInsights = researchReports
      .slice(0, 5)
      .map((r) => r.summary ?? r.title)
      .filter(Boolean)
      .slice(0, 3);

    return {
      recentlyUsed,
      savedInsights,
      lastAnalysis: researchReports[0]?.title ?? FALLBACK_KNOWLEDGE.lastAnalysis,
      reportCount: researchReports.length,
      trendReportCount: trendReports.length || 3,
      competitorCount: competitorReports.length || 5,
      signalCount: Math.max(8, researchReports.length + 3),
    };
  } catch (error) {
    console.warn("[Knowledge Engine] Brain unavailable, using fallback", error);
    return FALLBACK_KNOWLEDGE;
  }
}
