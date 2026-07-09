import type { KnowledgeRecipeMeta } from "@/lib/design/design-knowledge/types";

export interface CollectionLanguage {
  id: string;
  name: string;
  description: string;
  preferredLayouts: string[];
  preferredTypography: string[];
  preferredSymbols: string[];
  preferredOrnaments: string[];
  spacing: number;
  hierarchy: "type-first" | "geometry-first" | "balanced";
  negativeSpace: number;
  tags: string[];
}

export const COLLECTION_LANGUAGES: CollectionLanguage[] = [
  {
    id: "faith",
    name: "Faith Collection",
    description: "Sacred geometry, vertical rails, restrained symbolism with editorial gravity.",
    preferredLayouts: ["Faith Editorial", "Vertical Composition", "Radial Composition"],
    preferredTypography: ["Vertical Typography", "Luxury Serif", "Roman Numeral"],
    preferredSymbols: ["Cross Systems", "Sacred Geometry", "Broken Halo"],
    preferredOrnaments: ["Faith Ornaments", "Vertical Rules", "Roman Numeral"],
    spacing: 1.15,
    hierarchy: "geometry-first",
    negativeSpace: 0.44,
    tags: ["faith", "sacred", "vertical"],
  },
  {
    id: "silent",
    name: "Silent Collection",
    description: "Maximum restraint. Large voids, micro accents, whispered metadata.",
    preferredLayouts: ["Silent Luxury", "Negative Space Composition", "Minimal Luxury"],
    preferredTypography: ["Museum Label", "Ghost Typography", "Multi Scale"],
    preferredSymbols: ["Negative Circle", "Minimal Construction", "Halo Restraint"],
    preferredOrnaments: ["Silent Accents", "Micro Dots", "Museum Captions"],
    spacing: 1.28,
    hierarchy: "balanced",
    negativeSpace: 0.58,
    tags: ["silent", "minimal", "void"],
  },
  {
    id: "architect",
    name: "Architect Collection",
    description: "Structural frames, coordinate systems, measured precision.",
    preferredLayouts: ["Architectural", "Frame Composition", "Split Composition"],
    preferredTypography: ["Coordinates", "Modern Grotesk", "Production ID"],
    preferredSymbols: ["Architectural Frame", "Coordinate Systems", "Grid Foundation"],
    preferredOrnaments: ["Measurement Systems", "Alignment Marks", "Architect Registration"],
    spacing: 1.1,
    hierarchy: "geometry-first",
    negativeSpace: 0.46,
    tags: ["architect", "frame", "structure"],
  },
  {
    id: "museum",
    name: "Museum Collection",
    description: "Gallery labels, indexing systems, curatorial quiet luxury.",
    preferredLayouts: ["Museum Label", "Floating Composition", "Offset Composition"],
    preferredTypography: ["Museum Label", "Roman Numeral", "Capsule ID"],
    preferredSymbols: ["Diamond Systems", "Gallery Marks", "Frame Nest"],
    preferredOrnaments: ["Museum Captions", "Gallery Labels", "Serial IDs"],
    spacing: 1.22,
    hierarchy: "balanced",
    negativeSpace: 0.52,
    tags: ["museum", "gallery", "label"],
  },
  {
    id: "season",
    name: "Season Collection",
    description: "Campaign energy with editorial typography and oversized scale.",
    preferredLayouts: ["Campaign Poster", "Oversized Front", "Gallery Editorial"],
    preferredTypography: ["Oversized Typography", "Collection Name", "Editorial Sans"],
    preferredSymbols: ["Campaign Symbol", "Dual Arc", "Gallery Marks"],
    preferredOrnaments: ["Campaign Stamps", "Season Index", "Luxury Borders"],
    spacing: 1.05,
    hierarchy: "type-first",
    negativeSpace: 0.38,
    tags: ["season", "campaign", "oversized"],
  },
  {
    id: "capsule",
    name: "Capsule Collection",
    description: "Limited drops with capsule IDs, restrained symbols, micro metadata.",
    preferredLayouts: ["Minimal Luxury", "Offset Composition", "Floating Composition"],
    preferredTypography: ["Capsule ID", "Garment ID", "Split Typography"],
    preferredSymbols: ["Capsule Systems", "Diamond Systems", "Minimal Construction"],
    preferredOrnaments: ["Capsule Metadata", "Production Stamps", "Micro Dots"],
    spacing: 1.18,
    hierarchy: "balanced",
    negativeSpace: 0.5,
    tags: ["capsule", "limited", "drop"],
  },
  {
    id: "editorial",
    name: "Editorial Collection",
    description: "Full editorial language — broken alignment, depth, movement, story.",
    preferredLayouts: ["Luxury Editorial", "Broken Editorial", "Layered Composition"],
    preferredTypography: ["Editorial Sans", "Broken Typography", "Multi Scale"],
    preferredSymbols: ["Editorial Markers", "Dual Arc", "Broken Halo"],
    preferredOrnaments: ["Editorial Rules", "Editorial Dividers", "Flank Strikes"],
    spacing: 1.12,
    hierarchy: "type-first",
    negativeSpace: 0.42,
    tags: ["editorial", "campaign", "story"],
  },
];

export function getCollectionLanguages(): CollectionLanguage[] {
  return COLLECTION_LANGUAGES;
}

export function getCollectionById(id: string): CollectionLanguage | undefined {
  return COLLECTION_LANGUAGES.find((c) => c.id === id);
}

export function resolveCollection(text: string): CollectionLanguage {
  const lower = text.toLowerCase();
  for (const col of COLLECTION_LANGUAGES) {
    if (col.tags.some((t) => lower.includes(t))) return col;
  }
  if (lower.includes("faith")) return COLLECTION_LANGUAGES[0]!;
  if (lower.includes("silent")) return COLLECTION_LANGUAGES[1]!;
  if (lower.includes("architect")) return COLLECTION_LANGUAGES[2]!;
  if (lower.includes("museum") || lower.includes("gallery")) return COLLECTION_LANGUAGES[3]!;
  if (lower.includes("capsule") || lower.includes("limited")) return COLLECTION_LANGUAGES[5]!;
  return COLLECTION_LANGUAGES[6]!;
}
