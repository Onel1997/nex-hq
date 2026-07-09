export type MarketPrintMaterial = {
  id: string;
  name: string;
  description: string;
  premiumTier: "premium" | "standard";
  /** Typical garment categories using this material */
  categories: string[];
  printMethods: Array<"DTG" | "screen" | "embroidery">;
  visualNotes: string;
};

export const MARKETPRINT_MATERIALS: MarketPrintMaterial[] = [
  {
    id: "heavyweight-cotton",
    name: "Heavyweight Cotton",
    description: "400–500 GSM premium cotton fleece and jersey",
    premiumTier: "premium",
    categories: ["Heavyweight Hoodies", "Heavyweight Tees", "Sweatshirts"],
    printMethods: ["DTG", "embroidery"],
    visualNotes: "Dense texture, structured drape, premium streetwear hand-feel",
  },
  {
    id: "premium-jersey",
    name: "Premium Jersey",
    description: "220–280 GSM ring-spun cotton jersey",
    premiumTier: "premium",
    categories: ["T-Shirts", "Oversized Tees", "Heavyweight Tees"],
    printMethods: ["DTG", "screen"],
    visualNotes: "Clean surface, crisp print registration, minimal pilling",
  },
  {
    id: "french-terry",
    name: "French Terry",
    description: "Mid-weight loopback terry for hoodies and sweatshirts",
    premiumTier: "premium",
    categories: ["Hoodies", "Sweatshirts"],
    printMethods: ["DTG", "embroidery"],
    visualNotes: "Soft interior loop, matte exterior, relaxed silhouette",
  },
  {
    id: "acrylic-wool-blend",
    name: "Acrylic Wool Blend",
    description: "Structured knit for beanies and cold-weather accessories",
    premiumTier: "standard",
    categories: ["Beanies"],
    printMethods: ["embroidery"],
    visualNotes: "Ribbed cuff detail, embroidery-friendly knit surface",
  },
  {
    id: "structured-cap-cotton",
    name: "Structured Cotton Twill",
    description: "Six-panel cap blank with structured crown",
    premiumTier: "premium",
    categories: ["Caps"],
    printMethods: ["embroidery", "DTG"],
    visualNotes: "Clean crown for 3D embroidery, curved brim, premium streetwear cap",
  },
  {
    id: "canvas-accessory",
    name: "Canvas & Nylon Accessories",
    description: "Tote bags, pouches, and small accessories",
    premiumTier: "standard",
    categories: ["Accessories"],
    printMethods: ["DTG", "screen"],
    visualNotes: "Flat print surface, utility streetwear aesthetic",
  },
];

export const MARKETPRINT_MATERIAL_BY_ID: Record<
  string,
  MarketPrintMaterial
> = Object.fromEntries(MARKETPRINT_MATERIALS.map((m) => [m.id, m]));

export function getMaterialByName(name: string): MarketPrintMaterial | undefined {
  const normalized = name.toLowerCase();
  return MARKETPRINT_MATERIALS.find(
    (m) =>
      m.name.toLowerCase() === normalized ||
      normalized.includes(m.id.replace(/-/g, " ")),
  );
}

export function getMaterialsForCategory(category: string): MarketPrintMaterial[] {
  return MARKETPRINT_MATERIALS.filter((m) =>
    m.categories.some((c) => c.toLowerCase() === category.toLowerCase()),
  );
}
