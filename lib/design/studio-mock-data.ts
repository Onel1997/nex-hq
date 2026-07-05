import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { DesignDirection, DesignDirectionScores, TeamInsight } from "@/lib/design/design-directions";
import { runAiDesigner } from "@/lib/design/ai-designer";
import { buildDesignMissionFromHandoff } from "@/lib/design/design-mission-store";
import type { DesignMissionState } from "@/lib/design/design-mission-store";
import {
  buildAiDesignerMasterArtworkDraft,
  type MasterArtworkCommercialPayload,
} from "@/lib/design/master-artwork";
import { buildDesignStudioFromProductKnowledge } from "@/lib/design/studio-intelligence";
import type { DesignStudioData } from "@/components/design/use-design-studio";
import type { ProductKnowledge } from "@/lib/shopify/types";

const MOCK_REPORT_ID = "00000000-0000-4000-8000-000000mock01";

const DIRECTION_TEMPLATES = [
  {
    title: "Neo Heritage",
    philosophy: "Quiet luxury meets archival craft — heritage signals recontextualized for modern street.",
    mood: "Heritage luxe",
    typography: "Wide-tracked editorial serif accents",
    printStyle: "Tone-on-tone screen print",
    fashionKeywords: ["heritage craft", "quiet luxury", "archival mood"],
    composition: "Crest placement with ornamental framing",
    colorSystem: "Washed earth tones with stone accents",
    targetAudience: "Culture-conscious minimalists, 28–40",
    trendAlignment: "Heritage revival / calm luxury street",
    storyAngle:
      "Time-worn elegance translated into a wearable symbol system — restrained, premium, unmistakably Milaene.",
    colors: ["#2a2520", "#8b7355", "#e8e0d4"],
    scores: { commercial: 86, originality: 82, brandFit: 88, conversion: 84, luxury: 90, mfg: 28, print: 35, virality: 72, collection: 85 },
  },
  {
    title: "Silent Utility",
    philosophy: "Function as aesthetic — every mark earns its place through utility and restraint.",
    mood: "Technical calm",
    typography: "Mono-spaced micro-type with utility labeling",
    printStyle: "DTG fine line",
    fashionKeywords: ["technical luxury", "utility wear", "functional minimal"],
    composition: "Asymmetric utility grid with micro-labels",
    colorSystem: "Concrete grey, washed black, off-white",
    targetAudience: "Urban creatives, 25–35",
    trendAlignment: "Gorpcore refinement / quiet utility",
    storyAngle:
      "Garment-as-tool philosophy — precision markings and negative space define a utilitarian luxury capsule.",
    colors: ["#3d4450", "#1a1f2e", "#c8cdd4"],
    scores: { commercial: 81, originality: 88, brandFit: 79, conversion: 78, luxury: 76, mfg: 32, print: 42, virality: 80, collection: 82 },
  },
  {
    title: "Memory Fragments",
    philosophy: "Emotional minimalism through fragmented symbolism — personal narrative on premium blanks.",
    mood: "Reflective intimacy",
    typography: "Light sans with poetic line breaks",
    printStyle: "Soft-hand water-based ink",
    fashionKeywords: ["emotional minimal", "symbol fragments", "intimate scale"],
    composition: "Scattered symbol field with narrative flow",
    colorSystem: "Muted beige, soft black, natural raw",
    targetAudience: "Emotionally driven buyers, 22–34",
    trendAlignment: "Meaning-first streetwear / quiet devotion",
    storyAngle:
      "Scattered marks tell a private story — each fragment invites interpretation without shouting.",
    colors: ["#d4c8b8", "#2c2824", "#9a8f7f"],
    scores: { commercial: 79, originality: 91, brandFit: 86, conversion: 76, luxury: 84, mfg: 38, print: 48, virality: 74, collection: 88 },
  },
  {
    title: "Raw Luxury",
    philosophy: "Unpolished premium — material truth over graphic noise.",
    mood: "Material-led premium",
    typography: "Single-weight refined sans, minimal",
    printStyle: "Embroidery + tonal print",
    fashionKeywords: ["raw luxury", "material truth", "tonal restraint"],
    composition: "Micro-branding with material focus",
    colorSystem: "Washed black, cream, natural beige",
    targetAudience: "Premium basics collectors, 30–45",
    trendAlignment: "Quiet wealth / stealth luxury",
    storyAngle:
      "The garment speaks through fabric and proportion — graphics exist only to anchor the material story.",
    colors: ["#1a1a1a", "#f5f0e8", "#8a8278"],
    scores: { commercial: 88, originality: 75, brandFit: 92, conversion: 86, luxury: 94, mfg: 22, print: 28, virality: 68, collection: 90 },
  },
  {
    title: "Urban Mythology",
    philosophy: "Street folklore through iconographic narrative — symbols carry cultural weight.",
    mood: "Iconographic street",
    typography: "Mixed hierarchy with symbol anchors",
    printStyle: "Spot color + DTG halftone",
    fashionKeywords: ["urban myth", "symbol system", "culture drop"],
    composition: "Layered symbol field with narrative hierarchy",
    colorSystem: "Deep black with symbolic accent tones",
    targetAudience: "Streetwear collectors, 18–30",
    trendAlignment: "Graphic narrative / culture drops",
    storyAngle:
      "A visual mythology built from urban symbols — each mark part of a larger cultural story on premium fleece.",
    colors: ["#0f1218", "#52c2c2", "#d9b46b"],
    scores: { commercial: 83, originality: 86, brandFit: 74, conversion: 82, luxury: 70, mfg: 52, print: 58, virality: 88, collection: 78 },
  },
] as const;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickDirectionCount(brief: DesignStudioBrief): number {
  return 3 + (hashSeed(brief.designId) % 3);
}

function buildTeamInsights(
  template: (typeof DIRECTION_TEMPLATES)[number],
  scores: DesignDirectionScores,
): TeamInsight[] {
  return [
    {
      role: "Research Director",
      focus: "Trend Intelligence",
      insight: `${template.trendAlignment} aligns with current momentum for ${template.targetAudience}.`,
    },
    {
      role: "Creative Director",
      focus: "Visual Story",
      insight: template.storyAngle,
    },
    {
      role: "Typography Director",
      focus: "Typography hierarchy",
      insight: `${template.typography} — supports ${template.mood} mood with editorial restraint.`,
    },
    {
      role: "Fashion Designer",
      focus: "Garment composition",
      insight: `${template.composition} · ${template.fashionKeywords.join(" · ")}.`,
    },
    {
      role: "Commercial Director",
      focus: "Conversion analysis",
      insight: `Conversion potential at ${scores.conversionPotential}% — strong ${template.targetAudience} fit.`,
    },
    {
      role: "Print Engineer",
      focus: "Production feasibility",
      insight: `${template.printStyle} — complexity ${scores.printComplexity}%, manufacturing ${scores.manufacturingDifficulty}%.`,
    },
  ];
}

function templateToDirection(
  template: (typeof DIRECTION_TEMPLATES)[number],
  index: number,
  brief: DesignStudioBrief,
  concept: DesignConcept,
): DesignDirection {
  const scores: DesignDirectionScores = {
    commercial: template.scores.commercial,
    originality: template.scores.originality,
    brandFit: template.scores.brandFit,
    conversionPotential: template.scores.conversion,
    luxury: template.scores.luxury,
    manufacturingDifficulty: template.scores.mfg,
    virality: template.scores.virality,
    collectionFit: template.scores.collection,
    printComplexity: template.scores.print,
  };

  return {
    id: crypto.randomUUID(),
    title: template.title,
    philosophy: template.philosophy,
    designStory: `${template.storyAngle} Built for ${concept.collection || brief.title} — ${concept.creativeDirection.visualIntent}.`,
    fashionLanguage: template.fashionKeywords.join(" · "),
    mood: template.mood,
    typography: template.typography,
    printStyle: template.printStyle,
    colorSystem: template.colorSystem,
    composition: template.composition,
    targetAudience: template.targetAudience,
    trendAlignment: template.trendAlignment,
    thumbnailColors: [...template.colors],
    variantIndex: index,
    scores,
    teamInsights: buildTeamInsights(template, scores),
    archived: false,
    selected: false,
    compareSelected: false,
  };
}

/** Generate 3–5 design directions locally — no API. */
export function generateMockDesignDirections(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  options?: { avoidTitles?: string[]; count?: number },
): DesignDirection[] {
  const count = options?.count ?? pickDirectionCount(brief);
  const avoid = new Set((options?.avoidTitles ?? []).map((t) => t.toLowerCase()));

  const pool = DIRECTION_TEMPLATES.filter((t) => !avoid.has(t.title.toLowerCase()));
  const seed = hashSeed(`${brief.designId}:${Date.now()}`);
  const rotated = [...pool.slice(seed % pool.length), ...pool.slice(0, seed % pool.length)];

  return rotated
    .slice(0, count)
    .map((template, index) => templateToDirection(template, index, brief, concept))
    .sort((a, b) => b.scores.commercial - a.scores.commercial);
}

export function regenerateMockDesignDirection(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  directions: DesignDirection[],
  directionId: string,
): DesignDirection {
  const source = directions.find((d) => d.id === directionId);
  const avoidTitles = directions.map((d) => d.title);
  const [fresh] = generateMockDesignDirections(brief, concept, {
    avoidTitles,
    count: 1,
  });

  return {
    ...fresh,
    id: directionId,
    variantIndex: source?.variantIndex ?? 0,
    selected: source?.selected ?? false,
    archived: source?.archived ?? false,
    compareSelected: source?.compareSelected ?? false,
  };
}

export function createMockDesignStudioBrief(): DesignStudioBrief {
  return {
    designId: "mock-quiet-ascent-hero",
    title: "Quiet Ascent — Hero Piece",
    role: "Hero Piece",
    product: "Oversized Hoodie",
    color: "Washed Black",
    printArea: "Front",
    placement: "Center chest, 8 cm below collar seam",
    dimensions: "28 cm wide × 14 cm tall",
    visualConcept:
      "Organic curve system with editorial negative space — calm luxury streetwear mark anchored on premium fleece.",
    designDescription:
      "Three curved lines begin below the left shoulder and travel diagonally across the chest. Tone-on-tone ink with soft hand feel.",
    geometry: "3 parallel organic curves, 2 mm stroke, 18 mm spacing",
    visualElements: ["organic curve", "negative space field", "tonal mark"],
    typography: "No type — symbol-led composition",
    colorPalette: [
      { name: "Washed Black", usage: "Garment base", hex: "#1a1a1a" },
      { name: "Stone Grey", usage: "Ink tone", hex: "#8a8278" },
      { name: "Off White", usage: "Accent", hex: "#f5f0e8" },
    ],
    productionMethod: "Water-based screen print, 1-color tonal",
    materialEffects: "Soft hand feel, 15% distress on outer edge",
    negativeSpaceRules: "Minimum 12 cm clear below mark before pocket seam",
    designerInstructions: [
      "Center composition on chest vertical axis, top edge 8 cm below collar.",
      "Apply tonal ink at 85% opacity for quiet luxury effect.",
      "Preserve 40% negative space around focal system.",
    ],
    svgPrompt:
      "Premium streetwear artwork, organic curves, washed black hoodie, tonal grey ink, editorial negative space, calm luxury, transparent background, print-ready vector",
    mockupPrompt:
      "Flat-lay oversized hoodie, washed black, center chest tonal graphic, soft daylight, luxury minimal styling",
    imagePrompt:
      "Milaene oversized hoodie washed black, organic curve chest graphic, calm luxury streetwear, editorial composition",
    printReadinessScore: 82,
    dnaScore: 86,
    commercialScore: 84,
    campaignPotential: "Strong hero piece for capsule launch",
  };
}

export function createMockAiDesignerConcept(brief: DesignStudioBrief): {
  concept: DesignConcept;
  renderPlan: ReturnType<typeof runAiDesigner>["renderPlan"];
  review: ReturnType<typeof runAiDesigner>["review"];
} {
  const result = runAiDesigner({ brief });
  return {
    concept: result.concept,
    renderPlan: result.renderPlan,
    review: result.review,
  };
}

export function buildMockDesignMission(): DesignMissionState {
  const brief = createMockDesignStudioBrief();
  return buildDesignMissionFromHandoff({
    reportId: MOCK_REPORT_ID,
    brainRecordId: "mock-brain-record",
    reportTitle: "Mock Research — Quiet Ascent Capsule",
    collectionName: "Quiet Ascent",
    brief,
  });
}

export function getMockReportId(): string {
  return MOCK_REPORT_ID;
}

function buildMockArtworkSvg(title: string, colors: string[]): string {
  const [primary, secondary, accent] = colors;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${secondary ?? primary}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${accent ?? primary}" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="none"/>
  <path d="M120 380 Q400 180 680 380" fill="none" stroke="url(#g)" stroke-width="8" stroke-linecap="round"/>
  <path d="M160 420 Q400 260 640 420" fill="none" stroke="${primary}" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
  <path d="M200 460 Q400 340 600 460" fill="none" stroke="${secondary ?? primary}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
  <circle cx="400" cy="320" r="18" fill="${accent ?? primary}" opacity="0.85"/>
  <text x="400" y="560" text-anchor="middle" fill="${primary}" font-family="system-ui,sans-serif" font-size="22" font-weight="600" letter-spacing="6" opacity="0.65">${title.toUpperCase().slice(0, 18)}</text>
</svg>`;
}

export function buildMockMasterArtworkDataUrl(title: string, colors: string[]): string {
  const svg = buildMockArtworkSvg(title, colors);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildMockMasterArtworkState(input: {
  brief: DesignStudioBrief;
  version: string;
  directionTitle: string;
  directionColors: string[];
  designDirection?: string;
  conceptId: string;
}) {
  const artworkUrl = buildMockMasterArtworkDataUrl(input.directionTitle, input.directionColors);
  const commercialReview: MasterArtworkCommercialPayload = {
    approved: false,
    iterations: 1,
    score: { overall: input.brief.commercialScore ?? 84 },
    imageStudioBlueprint: `Mock blueprint for ${input.directionTitle}`,
  };

  return buildAiDesignerMasterArtworkDraft({
    brief: input.brief,
    version: input.version,
    artworkImageUrl: artworkUrl,
    transparentPngUrl: artworkUrl,
    productionPngUrl: artworkUrl,
    previewUrl: artworkUrl,
    selectedConceptId: input.conceptId,
    designDirection: input.designDirection ?? input.directionTitle,
    generationMode: "draft",
    dpi: 300,
    resolution: "4000 × 4000 px",
    transparentBackground: true,
    printReady: true,
    commercialReview,
  });
}

const MOCK_PRODUCT_KNOWLEDGE: ProductKnowledge = {
  availableProducts: [
    {
      id: "mock-hoodie-1",
      title: "Faith Oversized Hoodie",
      productType: "Hoodie",
      price: "89.00",
      currency: "EUR",
      status: "active",
      inventory: 120,
      collections: ["Essentials", "Quiet Ascent"],
      colors: ["Washed Black", "Natural Raw", "Stone Grey"],
      sizes: ["S", "M", "L", "XL"],
      materials: ["480gsm French Terry"],
    },
    {
      id: "mock-tee-1",
      title: "Calm Essential Tee",
      productType: "T-Shirt",
      price: "49.00",
      currency: "EUR",
      status: "active",
      inventory: 200,
      collections: ["Essentials"],
      colors: ["Black", "Cream", "Washed Black"],
      sizes: ["S", "M", "L", "XL"],
      materials: ["Premium Jersey"],
    },
  ],
  availableCategories: ["Hoodies", "T-Shirts", "Beanies"],
  availableColors: ["Washed Black", "Natural Raw", "Stone Grey", "Cream"],
  availableMaterials: ["480gsm French Terry", "Premium Jersey"],
  collections: ["Essentials", "Quiet Ascent", "Winter Core"],
  priceBands: [
    { label: "Core", range: "€40–€60", productCount: 4 },
    { label: "Premium", range: "€80–€120", productCount: 2 },
  ],
  productCount: 6,
  bestsellerCandidates: [],
  inventoryState: {
    totalProducts: 6,
    activeProducts: 6,
    draftProducts: 0,
    totalInventory: 480,
    inStock: 6,
    outOfStock: 0,
    lowStock: 0,
  },
  categoryGaps: ["Beanies", "Accessories"],
};

export function buildMockDesignStudioData(): DesignStudioData {
  const studio = buildDesignStudioFromProductKnowledge(MOCK_PRODUCT_KNOWLEDGE);
  return {
    studio,
    productKnowledge: MOCK_PRODUCT_KNOWLEDGE,
    commerceHistory: null,
    businessMeta: {
      primarySupplier: "MarketPrint Print On Demand",
      businessModel: "Print On Demand",
      fulfillment: "Supplier Managed",
    },
  };
}

/** Simulate async generation delay for premium loading states. */
export function mockGenerationDelay(ms = 2800): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
