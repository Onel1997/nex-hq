import type { ArtworkFileMetadata } from "@/lib/design/artwork-validation";
import type { ArtworkAnalysisResult } from "./types";

export function analyzeDocumentArtwork(metadata: ArtworkFileMetadata): ArtworkAnalysisResult {
  const fileLabel = metadata.fileKind.toUpperCase();
  const reason = `${fileLabel} artwork captured — deep pixel analysis requires PNG or SVG export.`;

  return {
    status: "unavailable",
    typography: {
      detected: false,
      style: "Minimal",
      blocks: [],
      hierarchyScore: 0,
      letterSpacing: "Unknown",
      alignment: "Unknown",
      summary: reason,
    },
    colorPalette: {
      swatches: [],
      contrastScore: 0,
      printFriendliness: 0,
      summary: reason,
    },
    composition: {
      balanceScore: 0,
      negativeSpacePercent: 0,
      visualWeight: "Light",
      focalPoint: { x: 50, y: 50, label: "Pending preview" },
      readingDirection: "Center-out",
      alignment: "Centered",
      symmetryScore: 0,
      qualityScore: 0,
      summary: reason,
    },
    graphicStyle: {
      primary: "Mixed",
      badges: ["Mixed"],
      summary: reason,
    },
    print: {
      placement: "Unknown",
      coveragePercent: 0,
      maxPrintSize: metadata.fileSize > 50_000 ? "Large document" : "Compact document",
      coverageLabel: "Low",
      summary: `${fileLabel} file stored — print mapping available after preview export.`,
    },
    commercial: {
      luxuryFeel: 0,
      commercialPotential: 0,
      brandConsistency: 0,
      trendPotential: 0,
      productionRisk: 40,
      manufacturingDifficulty: 35,
      summary: "Commercial scoring requires visual preview — export PNG or SVG for full analysis.",
    },
    brandDna: {
      overallScore: 0,
      traits: [],
      summary: "Brand DNA comparison requires visual preview.",
    },
    creative: {
      targetAudience: "—",
      emotion: "—",
      storytelling: reason,
      complexity: "Medium",
      luxuryPositioning: 0,
      visualHierarchy: 0,
      manufacturingComplexity: 35,
    },
    suggestions: [
      {
        id: "export-preview",
        message: "Optional: export a PNG or SVG preview for full creative analysis.",
        optional: true,
      },
    ],
    analyzedAt: new Date().toISOString(),
  };
}
