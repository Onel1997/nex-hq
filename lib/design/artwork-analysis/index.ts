import type { ArtworkFileMetadata } from "@/lib/design/artwork-validation";
import { analyzeDocumentArtwork } from "./analyze-document";
import { analyzeBrandDna } from "./brand-dna";
import { analyzeColorPalette } from "./color-palette";
import { analyzeCommercial } from "./commercial";
import { analyzeComposition, computeEdgeDensity } from "./composition";
import { analyzeCreative } from "./creative";
import { analyzeGraphicStyle } from "./graphic-style";
import { loadArtworkPixels } from "./pixel-source";
import { analyzePrint } from "./print-analysis";
import { buildSuggestions } from "./suggestions";
import { analyzeTypography } from "./typography";
import type { ArtworkAnalysisResult } from "./types";

export * from "./types";

function createUnavailableAnalysis(reason: string): ArtworkAnalysisResult {
  const emptyTypography = {
    detected: false,
    style: "Minimal" as const,
    blocks: [],
    hierarchyScore: 0,
    letterSpacing: "Unknown" as const,
    alignment: "Unknown" as const,
    summary: reason,
  };

  const emptyColors = {
    swatches: [],
    contrastScore: 0,
    printFriendliness: 0,
    summary: reason,
  };

  const emptyComposition = {
    balanceScore: 0,
    negativeSpacePercent: 0,
    visualWeight: "Light" as const,
    focalPoint: { x: 50, y: 50, label: "Unknown" },
    readingDirection: "Center-out" as const,
    alignment: "Centered" as const,
    symmetryScore: 0,
    qualityScore: 0,
    summary: reason,
  };

  return {
    status: "unavailable",
    error: reason,
    typography: emptyTypography,
    colorPalette: emptyColors,
    composition: emptyComposition,
    graphicStyle: {
      primary: "Mixed",
      badges: ["Mixed"],
      summary: reason,
    },
    print: {
      placement: "Unknown",
      coveragePercent: 0,
      maxPrintSize: "—",
      coverageLabel: "Low",
      summary: reason,
    },
    commercial: {
      luxuryFeel: 0,
      commercialPotential: 0,
      brandConsistency: 0,
      trendPotential: 0,
      productionRisk: 0,
      manufacturingDifficulty: 0,
      summary: reason,
    },
    brandDna: {
      overallScore: 0,
      traits: [],
      summary: reason,
    },
    creative: {
      targetAudience: "—",
      emotion: "—",
      storytelling: reason,
      complexity: "Low",
      luxuryPositioning: 0,
      visualHierarchy: 0,
      manufacturingComplexity: 0,
    },
    suggestions: [],
  };
}

export async function analyzeArtwork(input: {
  file: File;
  objectUrl: string;
  metadata: ArtworkFileMetadata;
  svgMarkup?: string;
}): Promise<ArtworkAnalysisResult> {
  const { metadata, svgMarkup, objectUrl } = input;

  if (metadata.fileKind === "pdf" || metadata.fileKind === "ai" || metadata.fileKind === "eps") {
    return analyzeDocumentArtwork(metadata);
  }

  try {
    const pixels = await loadArtworkPixels({
      fileKind: metadata.fileKind,
      objectUrl,
      width: metadata.width,
      height: metadata.height,
    });

    if (!pixels) {
      return createUnavailableAnalysis("Could not rasterize artwork for pixel analysis.");
    }

    const colors = analyzeColorPalette(pixels);
    const edgeDensity = computeEdgeDensity(pixels);
    const composition = analyzeComposition(pixels);
    const typography = analyzeTypography({
      fileKind: metadata.fileKind,
      svgMarkup,
      edgeDensity,
      contrastScore: colors.contrastScore,
    });
    const graphicStyle = analyzeGraphicStyle({
      typography,
      composition,
      colors,
      edgeDensity,
      svgMarkup,
    });
    const print = analyzePrint({ metadata, composition });
    const brandDna = analyzeBrandDna({ typography, colors, composition, graphicStyle });
    const inkCount = colors.swatches.filter((s) => s.role !== "background").length;
    const creative = analyzeCreative({
      typography,
      composition,
      graphicStyle,
      commercial: {
        luxuryFeel: 0,
        commercialPotential: 0,
        brandConsistency: brandDna.overallScore,
        trendPotential: 0,
        productionRisk: 0,
        manufacturingDifficulty: 0,
        summary: "",
      },
      edgeDensity,
      inkCount,
    });
    const commercial = analyzeCommercial({
      typography,
      colors,
      composition,
      graphicStyle,
      brandDna,
      edgeDensity,
      complexity: creative.complexity,
    });
    const suggestions = buildSuggestions({ colors, composition, print, creative });

    return {
      status: "complete",
      typography,
      colorPalette: colors,
      composition,
      graphicStyle,
      print,
      commercial,
      brandDna,
      creative: {
        ...creative,
        luxuryPositioning: commercial.luxuryFeel,
        manufacturingComplexity: commercial.manufacturingDifficulty,
      },
      suggestions,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return { ...createUnavailableAnalysis(message), status: "error", error: message };
  }
}

export function createIdleAnalysis(): ArtworkAnalysisResult {
  return createUnavailableAnalysis("Upload artwork to begin creative analysis.");
}

export function createAnalyzingAnalysis(): ArtworkAnalysisResult {
  return { ...createUnavailableAnalysis("Analyzing artwork…"), status: "analyzing" };
}
