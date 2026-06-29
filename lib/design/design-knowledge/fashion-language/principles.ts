export interface FashionPrinciple {
  id: string;
  name: string;
  description: string;
  weight: number;
  signals: string[];
  antiPatterns: string[];
}

/** Premium minimalist streetwear principles — not brand imitation. */
export const FASHION_PRINCIPLES: FashionPrinciple[] = [
  {
    id: "large-negative-space",
    name: "Large Negative Space",
    description: "Luxury lives in what you do not fill. Reserve generous void around the focal system.",
    weight: 0.92,
    signals: ["void", "breathing", "sparse", "silent"],
    antiPatterns: ["crowded", "filled", "dense-everywhere"],
  },
  {
    id: "editorial-typography",
    name: "Editorial Typography",
    description: "Type is artwork. It overlaps, breaks frames, and creates rhythm — never sits passively below a symbol.",
    weight: 0.9,
    signals: ["editorial", "tracking", "stacked", "oversized-type"],
    antiPatterns: ["logo-type", "centered-caption", "single-line-only"],
  },
  {
    id: "high-contrast-scale",
    name: "High Contrast Scale",
    description: "Mix monumental type with micro information. Never equal sizes across the hierarchy.",
    weight: 0.88,
    signals: ["oversized", "micro-label", "multi-scale"],
    antiPatterns: ["uniform-scale", "equal-weight"],
  },
  {
    id: "layer-interaction",
    name: "Layer Interaction",
    description: "Typography, symbols, and ornaments intersect. Depth comes from overlap, not stacking order alone.",
    weight: 0.86,
    signals: ["overlap", "depth", "ghost", "mask"],
    antiPatterns: ["isolated-layers", "wireframe-stack"],
  },
  {
    id: "symbol-restraint",
    name: "Symbol Restraint",
    description: "One dominant symbol system. Secondary geometry supports — never competes.",
    weight: 0.85,
    signals: ["restraint", "single-focal", "void"],
    antiPatterns: ["symbol-clutter", "competing-geometry"],
  },
  {
    id: "micro-information",
    name: "Micro Information",
    description: "Roman numerals, coordinates, capsule IDs — whispered metadata that signals premium production.",
    weight: 0.82,
    signals: ["roman", "coordinates", "capsule", "serial"],
    antiPatterns: ["no-metadata", "loud-labels"],
  },
  {
    id: "premium-balance",
    name: "Premium Balance",
    description: "Asymmetric but controlled. Optical balance over mathematical centering.",
    weight: 0.87,
    signals: ["asymmetric", "offset", "optical"],
    antiPatterns: ["perfect-center", "logo-symmetry"],
  },
  {
    id: "luxury-rhythm",
    name: "Luxury Rhythm",
    description: "Irregular spacing with editorial intention. Never uniform gaps or grid-perfect alignment.",
    weight: 0.84,
    signals: ["rhythm", "stagger", "editorial-spacing"],
    antiPatterns: ["uniform-spacing", "grid-locked"],
  },
  {
    id: "garment-awareness",
    name: "Garment Awareness",
    description: "Design for oversized tees and chest prints — not posters, logos, or wireframes.",
    weight: 0.91,
    signals: ["oversized", "apparel", "garment", "print-area"],
    antiPatterns: ["poster-scale", "logo-mark", "blueprint"],
  },
  {
    id: "editorial-storytelling",
    name: "Editorial Storytelling",
    description: "Every composition tells a collection story — season, faith, silence, or campaign.",
    weight: 0.83,
    signals: ["collection", "season", "campaign", "narrative"],
    antiPatterns: ["generic", "template-feel"],
  },
];

export function getFashionPrinciples(): FashionPrinciple[] {
  return FASHION_PRINCIPLES;
}

export function matchFashionPrinciples(text: string): FashionPrinciple[] {
  const lower = text.toLowerCase();
  return FASHION_PRINCIPLES.filter((p) =>
    p.signals.some((s) => lower.includes(s)) ||
    p.antiPatterns.every((a) => !lower.includes(a)),
  ).sort((a, b) => b.weight - a.weight);
}

export function getTopFashionPrinciples(text: string, limit = 5): FashionPrinciple[] {
  const matched = matchFashionPrinciples(text);
  const scored = FASHION_PRINCIPLES.map((p) => {
    let score = p.weight;
    if (matched.includes(p)) score += 0.15;
    if (p.signals.some((s) => text.toLowerCase().includes(s))) score += 0.1;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}
