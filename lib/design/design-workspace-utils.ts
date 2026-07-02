import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignHealthScores,
  DesignMissionAssets,
  DesignPromptOverrides,
  PerDesignWorkspace,
  ProductionItem,
} from "@/lib/design/design-mission-store";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeDesignHealth(brief: DesignStudioBrief): DesignHealthScores {
  const dna = brief.dnaScore ?? 72;
  const commercial = brief.commercialScore ?? 68;
  const print = brief.printReadinessScore;
  const elementLoad = Math.max(0, 100 - brief.visualElements.length * 8);

  return {
    luxury: clamp(dna * 0.55 + print * 0.25 + elementLoad * 0.2),
    originality: clamp(dna * 0.7 + (brief.campaignPotential === "high" ? 18 : 10)),
    printQuality: clamp(print),
    manufacturingComplexity: clamp(
      brief.productionMethod.toLowerCase().includes("screen") ? 55 : 42,
    ),
    brandConsistency: clamp(dna * 0.85),
    commercialPotential: clamp(commercial),
    trendAlignment: clamp(commercial * 0.6 + dna * 0.35),
    visualBalance: clamp(print * 0.5 + elementLoad * 0.5),
    colorHarmony: clamp(
      brief.colorPalette.length >= 2 ? 78 + brief.colorPalette.length * 2 : 65,
    ),
    typography: clamp(
      brief.typography.toLowerCase().includes("no type") ? 70 : 82,
    ),
  };
}

export const PRODUCTION_ITEMS: Array<{ id: ProductionItem["id"]; label: string }> = [
  { id: "svg", label: "SVG Ready" },
  { id: "mockup", label: "Mockup Ready" },
  { id: "aiRender", label: "AI Render Ready" },
  { id: "print", label: "Print Ready" },
  { id: "embroidery", label: "Embroidery Ready" },
  { id: "dtg", label: "DTG Ready" },
  { id: "screenPrint", label: "Screen Print Ready" },
  { id: "shopify", label: "Shopify Ready" },
  { id: "marketing", label: "Marketing Ready" },
  { id: "launch", label: "Launch Ready" },
];

export function defaultProductionChecklist(): ProductionItem[] {
  return PRODUCTION_ITEMS.map((item) => ({
    ...item,
    status: "pending" as const,
  }));
}

export function syncProductionChecklist(
  items: ProductionItem[],
  brief: DesignStudioBrief,
  assets: DesignMissionAssets,
  approvalStatus?: PerDesignWorkspace["approvalStatus"],
): ProductionItem[] {
  const printReady = brief.printReadinessScore >= 75;
  const embroidery =
    brief.productionMethod.toLowerCase().includes("embroid") ||
    brief.visualElements.some((e) => e.toLowerCase().includes("embroid"));
  const screen =
    brief.productionMethod.toLowerCase().includes("screen") ||
    brief.productionMethod.toLowerCase().includes("spot");

  const map: Record<ProductionItem["id"], ProductionItem["status"]> = {
    svg:
      assets.masterArtwork?.artworkImageUrl ||
      assets.masterArtwork?.status === "approved" ||
      assets.svgUrl
        ? "complete"
        : "pending",
    mockup: assets.mockupUrl ? "complete" : "pending",
    aiRender: assets.renderUrl ? "complete" : "pending",
    print: printReady ? "complete" : "pending",
    embroidery: embroidery && printReady ? "complete" : embroidery ? "working" : "pending",
    dtg:
      brief.productionMethod.toLowerCase().includes("dtg") && assets.mockupUrl
        ? "complete"
        : "pending",
    screenPrint: screen && assets.svgUrl ? "complete" : screen ? "working" : "pending",
    shopify: approvalStatus === "approved" ? "working" : "pending",
    marketing: approvalStatus === "approved" ? "working" : "pending",
    launch: approvalStatus === "approved" ? "working" : "pending",
  };

  return items.map((item) => ({
    ...item,
    status: map[item.id] ?? item.status,
  }));
}

export function applyBriefPatch(
  brief: DesignStudioBrief,
  patch: Partial<DesignStudioBrief>,
): DesignStudioBrief {
  return { ...brief, ...patch };
}

export function applyCreativeSuggestion(
  brief: DesignStudioBrief,
  message: string,
): { brief: DesignStudioBrief; note: string } {
  const lower = message.toLowerCase();
  let next = { ...brief };
  let note = "Refined the design direction based on your feedback.";

  if (lower.includes("minimal") || lower.includes("negative space")) {
    next = {
      ...next,
      visualConcept: `${next.visualConcept} Expanded negative space and reduced graphic density for editorial restraint.`,
      negativeSpaceRules:
        "Increase breathing room by 20%. Keep mark centered with generous margins.",
      geometry: next.geometry.includes("minimal")
        ? next.geometry
        : `Minimal ${next.geometry.toLowerCase()}`,
    };
    note = "Increased negative space and simplified the composition.";
  }

  if (lower.includes("premium") || lower.includes("luxury")) {
    next = {
      ...next,
      typography: "Refined uppercase serif-adjacent spacing — premium editorial lettering",
      materialEffects: "Soft-hand premium ink with tonal depth and matte finish",
    };
    note = "Elevated typography and material finish for a more premium feel.";
  }

  if (lower.includes("emotional")) {
    next = {
      ...next,
      designDescription: `${next.designDescription} Leans into intimate emotional restraint with softer symbolic abstraction.`,
      visualConcept: `${next.visualConcept} More emotionally resonant through subtle symbolism.`,
    };
    note = "Pushed the emotional narrative while keeping Milaene restraint.";
  }

  if (lower.includes("japanese") || lower.includes("less graphic")) {
    next = {
      ...next,
      geometry: "Asymmetric balance with single focal mark — Japanese minimal influence",
      visualElements: next.visualElements.slice(0, Math.max(1, next.visualElements.length - 1)),
    };
    note = "Reduced graphic weight with Japanese minimal balance.";
  }

  if (lower.includes("wearable") || lower.includes("commercial")) {
    next = {
      ...next,
      commercialScore: clamp((next.commercialScore ?? 70) + 6),
      placement: next.placement.replace(/8 cm/, "7 cm"),
    };
    note = "Optimized placement and commercial wearability.";
  }

  if (lower.includes("embroid")) {
    next = {
      ...next,
      productionMethod: "Tone-on-tone embroidery with matte thread",
      materialEffects: "Embroidered matte thread with soft loft",
    };
    note = "Shifted production toward embroidery-ready specifications.";
  }

  if (lower.includes("print effic")) {
    next = {
      ...next,
      colorPalette: next.colorPalette.slice(0, 2),
      productionMethod: "1-color screen print, production-safe spot palette",
    };
    note = "Simplified color count for print efficiency.";
  }

  return { brief: next, note };
}
