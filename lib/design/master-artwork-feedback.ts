import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignHealthScores } from "@/lib/design/design-mission-store";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";

export interface MasterArtworkDirectorFeedback {
  whyItWorks: string;
  typographyNote: string;
  compositionNote: string;
  printRisk: string;
  commercialOpportunity: string;
  suggestedNextVersion: string;
}

export interface MasterArtworkCommercialScores {
  luxury: number;
  originality: number;
  printQuality: number;
  brandFit: number;
  trendPotential: number;
  virality: number;
  manufacturingSimplicity: number;
  conversionPotential: number;
  overall: number;
}

function firstSentence(text: string, fallback: string): string {
  const sentence = text.split(/(?<=[.!?])\s+/)[0]?.trim();
  return sentence && sentence.length > 8 ? sentence : fallback;
}

/** Derive inspector commercial scores from direction, health, and artwork state — no backend. */
export function buildMasterArtworkCommercialScores(
  health: DesignHealthScores,
  direction?: DesignDirection,
  view?: MasterArtworkViewModel,
  concept?: DesignConcept,
): MasterArtworkCommercialScores {
  const masterScore = view?.state.commercialScore;
  const dir = direction?.scores;

  const luxury = dir?.luxury ?? health.luxury;
  const originality = dir?.originality ?? health.originality;
  const printQuality = view?.hasArtwork
    ? Math.max(health.printQuality, 100 - (dir?.printComplexity ?? 30))
    : health.printQuality;
  const brandFit = dir?.brandFit ?? health.brandConsistency;
  const trendPotential = dir?.collectionFit ?? health.trendAlignment;
  const virality = dir?.virality ?? Math.round(health.commercialPotential * 0.5 + health.originality * 0.5);
  const manufacturingSimplicity = dir
    ? Math.max(0, 100 - dir.manufacturingDifficulty)
    : Math.max(0, 100 - health.manufacturingComplexity);
  const conversionPotential = dir?.conversionPotential ?? health.commercialPotential;
  const overall =
    masterScore ??
    Math.round(
      (luxury + originality + printQuality + brandFit + conversionPotential) / 5,
    );

  return {
    luxury,
    originality,
    printQuality,
    brandFit,
    trendPotential,
    virality,
    manufacturingSimplicity,
    conversionPotential,
    overall,
  };
}

/** Concise AI Creative Director feedback — derived from local mission state. */
export function buildMasterArtworkDirectorFeedback(
  brief: DesignStudioBrief,
  direction?: DesignDirection,
  concept?: DesignConcept,
  view?: MasterArtworkViewModel,
  health?: DesignHealthScores,
): MasterArtworkDirectorFeedback {
  const commercial = direction?.teamInsights.find((i) => i.role.includes("Commercial"));
  const typography = direction?.teamInsights.find((i) => i.role.includes("Typography"));
  const fashion = direction?.teamInsights.find((i) => i.role.includes("Fashion"));

  const hasArtwork = view?.hasArtwork ?? false;
  const printComplexity = direction?.scores.printComplexity ?? health?.manufacturingComplexity ?? 40;

  return {
    whyItWorks: hasArtwork
      ? firstSentence(
          commercial?.insight ?? direction?.philosophy ?? "",
          `${direction?.title ?? brief.title} locks a clear visual identity with strong brand fit.`,
        )
      : `${direction?.title ?? "This direction"} offers a distinct creative territory — ${firstSentence(direction?.philosophy ?? brief.visualConcept, "ready to become print-ready artwork.")}`,

    typographyNote: typography?.insight
      ? firstSentence(typography.insight, direction?.typography ?? concept?.typographyLanguage.direction ?? "—")
      : direction?.typography ?? concept?.typographyLanguage.direction ?? brief.typography,

    compositionNote: hasArtwork
      ? firstSentence(
          fashion?.insight ?? direction?.composition ?? "",
          `${direction?.composition ?? "Center-weighted composition"} with editorial negative space.`,
        )
      : direction?.composition ?? concept?.compositionLanguage.pattern ?? brief.geometry,

    printRisk:
      printComplexity > 70
        ? "High complexity — verify minimum line weight and color count for POD."
        : printComplexity > 45
          ? "Moderate — confirm placement dimensions and ink coverage."
          : "Low risk — standard POD production profile.",

    commercialOpportunity: firstSentence(
      direction?.trendAlignment ?? commercial?.insight ?? concept?.commercialIntention.buyerHook ?? "",
      `Strong conversion potential with ${direction?.targetAudience ?? brief.title} positioning.`,
    ),

    suggestedNextVersion: hasArtwork
      ? view?.isApproved
        ? "Explore a restrained V2 with alternate composition spacing."
        : "V2: increase editorial negative space; reduce secondary graphic weight."
      : "Generate V1, then iterate with a typography-forward or symbol-led V2.",
  };
}
