export const MARKETPRINT_CATEGORIES = [
  "T-Shirts",
  "Oversized Tees",
  "Heavyweight Tees",
  "Hoodies",
  "Heavyweight Hoodies",
  "Sweatshirts",
  "Beanies",
  "Caps",
  "Accessories",
  "Embroidery Products",
] as const;

export type MarketPrintCategory = (typeof MARKETPRINT_CATEGORIES)[number];

export interface MarketPrintProductCapability {
  id: string;
  name: string;
  category: MarketPrintCategory;
  material: string;
  materialId: string;
  premiumScore: number;
  embroidery: boolean;
  printing: boolean;
  streetwearScore: number;
  recommendedUse: string;
  campaignSuitability: boolean;
  /** Keywords for matching Shopify catalog titles/types/tags */
  keywords: string[];
}

export const MARKETPRINT_PRODUCTS: MarketPrintProductCapability[] = [
  {
    id: "classic-tee",
    name: "Classic T-Shirt",
    category: "T-Shirts",
    material: "Premium Jersey",
    materialId: "premium-jersey",
    premiumScore: 7,
    embroidery: false,
    printing: true,
    streetwearScore: 7,
    recommendedUse: "Core logo tees and minimal graphics",
    campaignSuitability: true,
    keywords: ["t-shirt", "tee", "t shirt", "classic tee"],
  },
  {
    id: "oversized-tee",
    name: "Oversized Tee",
    category: "Oversized Tees",
    material: "Premium Jersey",
    materialId: "premium-jersey",
    premiumScore: 8,
    embroidery: false,
    printing: true,
    streetwearScore: 9,
    recommendedUse: "Boxy fits, statement prints, drop hero pieces",
    campaignSuitability: true,
    keywords: ["oversized", "boxy", "relaxed tee", "oversized tee"],
  },
  {
    id: "heavyweight-tee",
    name: "Heavyweight Tee",
    category: "Heavyweight Tees",
    material: "Heavyweight Cotton",
    materialId: "heavyweight-cotton",
    premiumScore: 9,
    embroidery: true,
    printing: true,
    streetwearScore: 9,
    recommendedUse: "Premium graphic tees, chest embroidery",
    campaignSuitability: true,
    keywords: ["heavyweight tee", "heavy tee", "450 gsm", "500 gsm", "thick tee"],
  },
  {
    id: "standard-hoodie",
    name: "Pullover Hoodie",
    category: "Hoodies",
    material: "French Terry",
    materialId: "french-terry",
    premiumScore: 8,
    embroidery: true,
    printing: true,
    streetwearScore: 9,
    recommendedUse: "Core hoodies, back prints, small chest embroidery",
    campaignSuitability: true,
    keywords: ["hoodie", "pullover", "hooded sweatshirt"],
  },
  {
    id: "heavyweight-hoodie",
    name: "Heavyweight Hoodie",
    category: "Heavyweight Hoodies",
    material: "Heavyweight Cotton",
    materialId: "heavyweight-cotton",
    premiumScore: 9,
    embroidery: true,
    printing: true,
    streetwearScore: 10,
    recommendedUse: "Flagship hoodies, premium drops, hero campaigns",
    campaignSuitability: true,
    keywords: [
      "heavyweight hoodie",
      "heavy hoodie",
      "450 gsm hoodie",
      "500 gsm hoodie",
      "premium hoodie",
    ],
  },
  {
    id: "crew-sweatshirt",
    name: "Crew Sweatshirt",
    category: "Sweatshirts",
    material: "French Terry",
    materialId: "french-terry",
    premiumScore: 8,
    embroidery: true,
    printing: true,
    streetwearScore: 8,
    recommendedUse: "Minimal crewnecks, tonal embroidery",
    campaignSuitability: true,
    keywords: ["sweatshirt", "crewneck", "crew neck", "sweater"],
  },
  {
    id: "heavyweight-sweatshirt",
    name: "Heavyweight Sweatshirt",
    category: "Sweatshirts",
    material: "Heavyweight Cotton",
    materialId: "heavyweight-cotton",
    premiumScore: 9,
    embroidery: true,
    printing: true,
    streetwearScore: 9,
    recommendedUse: "Premium crew layers, capsule collections",
    campaignSuitability: true,
    keywords: ["heavyweight sweatshirt", "heavy crew", "premium sweatshirt"],
  },
  {
    id: "beanie",
    name: "Embroidered Beanie",
    category: "Beanies",
    material: "Acrylic Wool Blend",
    materialId: "acrylic-wool-blend",
    premiumScore: 7,
    embroidery: true,
    printing: false,
    streetwearScore: 8,
    recommendedUse: "Logo beanies, winter capsule accessories",
    campaignSuitability: true,
    keywords: ["beanie", "knit hat", "winter hat"],
  },
  {
    id: "structured-cap",
    name: "Structured Cap",
    category: "Caps",
    material: "Structured Cotton Twill",
    materialId: "structured-cap-cotton",
    premiumScore: 8,
    embroidery: true,
    printing: true,
    streetwearScore: 9,
    recommendedUse: "Premium embroidered caps, 3D logo headwear",
    campaignSuitability: true,
    keywords: ["cap", "dad cap", "baseball cap", "structured cap", "snapback"],
  },
  {
    id: "premium-embroidered-cap",
    name: "Premium Embroidered Cap",
    category: "Embroidery Products",
    material: "Structured Cotton Twill",
    materialId: "structured-cap-cotton",
    premiumScore: 9,
    embroidery: true,
    printing: false,
    streetwearScore: 9,
    recommendedUse: "Hero headwear, 3D embroidery campaigns",
    campaignSuitability: true,
    keywords: ["embroidered cap", "premium cap", "3d embroidery cap"],
  },
  {
    id: "tote-bag",
    name: "Canvas Tote",
    category: "Accessories",
    material: "Canvas & Nylon Accessories",
    materialId: "canvas-accessory",
    premiumScore: 6,
    embroidery: false,
    printing: true,
    streetwearScore: 6,
    recommendedUse: "Brand accessories, gift-with-purchase",
    campaignSuitability: false,
    keywords: ["tote", "bag", "accessory", "pouch"],
  },
  {
    id: "embroidery-patch-hoodie",
    name: "Embroidery Hoodie",
    category: "Embroidery Products",
    material: "French Terry",
    materialId: "french-terry",
    premiumScore: 9,
    embroidery: true,
    printing: false,
    streetwearScore: 9,
    recommendedUse: "Embroidery-first hoodies, tonal premium pieces",
    campaignSuitability: true,
    keywords: ["embroidery hoodie", "embroidered hoodie", "embroidery"],
  },
];

export const MARKETPRINT_PRODUCT_BY_ID: Record<
  string,
  MarketPrintProductCapability
> = Object.fromEntries(MARKETPRINT_PRODUCTS.map((p) => [p.id, p]));

/** Categories MarketPrint cannot produce — route to secondary suppliers. */
export const EXTERNAL_ONLY_KEYWORDS = [
  "outerwear",
  "jacket",
  "coat",
  "puffer",
  "denim jacket",
  "leather",
  "luxury outerwear",
  "parka",
  "blazer",
  "suit",
  "dress",
  "skirt",
  "swimwear",
  "footwear",
  "sneaker",
  "shoe",
];

export interface ProductMatchInput {
  title: string;
  productType?: string;
  tags?: string[];
  materials?: string[];
}

export interface MarketPrintProductMatch {
  capability: MarketPrintProductCapability;
  /** 0–100 suitability for MarketPrint production */
  suitability: number;
  externalSupplierRecommended: boolean;
  matchReason: string;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function collectSearchText(input: ProductMatchInput): string {
  return normalize(
    [input.title, input.productType ?? "", ...(input.tags ?? []), ...(input.materials ?? [])].join(
      " ",
    ),
  );
}

function scoreKeywordMatch(searchText: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (searchText.includes(normalize(keyword))) {
      score += keyword.split(" ").length >= 2 ? 3 : 2;
    }
  }
  return score;
}

export function matchProductToMarketPrint(
  input: ProductMatchInput,
): MarketPrintProductMatch {
  const searchText = collectSearchText(input);

  for (const external of EXTERNAL_ONLY_KEYWORDS) {
    if (searchText.includes(normalize(external))) {
      return {
        capability: MARKETPRINT_PRODUCTS[0],
        suitability: 15,
        externalSupplierRecommended: true,
        matchReason: `Category outside MarketPrint catalog (${external}) — external supplier recommended`,
      };
    }
  }

  let best: { capability: MarketPrintProductCapability; score: number } | null =
    null;

  for (const capability of MARKETPRINT_PRODUCTS) {
    const keywordScore = scoreKeywordMatch(searchText, capability.keywords);
    const categoryScore = searchText.includes(normalize(capability.category))
      ? 2
      : 0;
    const total = keywordScore + categoryScore;

    if (!best || total > best.score) {
      best = { capability, score: total };
    }
  }

  if (!best || best.score === 0) {
    const fallback = MARKETPRINT_PRODUCTS.find((p) => p.id === "classic-tee")!;
    return {
      capability: fallback,
      suitability: 45,
      externalSupplierRecommended: false,
      matchReason: "Weak catalog match — verify against MarketPrint product sheet",
    };
  }

  const { capability, score } = best;
  const baseSuitability = Math.min(
    100,
    Math.round(
      55 +
        score * 8 +
        capability.premiumScore * 2 +
        capability.streetwearScore * 1.5,
    ),
  );

  return {
    capability,
    suitability: Math.min(98, baseSuitability),
    externalSupplierRecommended: baseSuitability < 50,
    matchReason: `Matched ${capability.name} (${capability.category})`,
  };
}

export function getPremiumProducts(): MarketPrintProductCapability[] {
  return MARKETPRINT_PRODUCTS.filter((p) => p.premiumScore >= 8);
}

export function getEmbroideryProducts(): MarketPrintProductCapability[] {
  return MARKETPRINT_PRODUCTS.filter((p) => p.embroidery);
}

export function getCampaignProducts(): MarketPrintProductCapability[] {
  return MARKETPRINT_PRODUCTS.filter((p) => p.campaignSuitability);
}

export function getProductsByCategory(
  category: MarketPrintCategory,
): MarketPrintProductCapability[] {
  return MARKETPRINT_PRODUCTS.filter((p) => p.category === category);
}

export function formatSuitabilityLabel(suitability: number): string {
  return `MarketPrint suitability ${suitability}%`;
}
