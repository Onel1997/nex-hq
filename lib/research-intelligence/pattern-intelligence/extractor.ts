import type { CommerceProductRecord } from "@/lib/shopify/commerce-intelligence-types";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import {
  isCatalogProductReference,
  normalizeProductReference as normalizeCatalogReference,
  stripVariantFromTitle,
} from "./catalog-filter";
import { parseStructuredMaterials } from "./material-parser";
import type { ExtractedProductPattern, HistoricalPerformance, PatternDimension } from "./types";

export const INSUFFICIENT_SHOPIFY_EVIDENCE =
  "Für dieses Merkmal liegen noch keine ausreichend strukturierten Shopify-Daten vor.";

const TYPOGRAPHY_TAGS: Record<string, string> = {
  minimal: "Minimal Sans",
  serif: "Minimal Serif",
  sans: "Minimal Sans",
  condensed: "Condensed Sans",
  editorial: "Editorial Serif",
  technical: "Technical Serif",
  letterspacing: "Großzügiges Letterspacing",
  hierarchy: "Ruhige Hierarchie",
};

const PLACEMENT_TAGS: Record<string, string> = {
  "back print": "Großer Rückenprint",
  backprint: "Großer Rückenprint",
  "back graphic": "Großer Rückenprint",
  embroidery: "Kleine Bruststickerei",
  "chest embroidery": "Kleine Bruststickerei",
  "small chest": "Kleine Bruststickerei",
  spine: "Vertikale Rückenachse",
};

const GRAPHIC_TAGS: Record<string, string> = {
  archive: "Archive",
  texture: "Texture",
  geometric: "Broken Geometry",
  emblem: "Quiet Luxury",
  minimal: "Quiet Luxury",
  luxury: "Quiet Luxury",
  "quiet luxury": "Quiet Luxury",
  restraint: "Quiet Luxury",
};

const PRINT_TAGS: Record<string, string> = {
  "screen print": "Screen Print",
  screenprint: "Screen Print",
  embroidery: "Embroidery",
  dtg: "DTG",
};

const COLOR_MAP: Record<string, string> = {
  black: "Schwarz",
  white: "Off White",
  cream: "Off White",
  stone: "Stone",
  grey: "Ash Grey",
  gray: "Ash Grey",
  washed: "Washed Grey",
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchFromMap(corpus: string, map: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [needle, label] of Object.entries(map)) {
    if (corpus.includes(needle)) hits.push(label);
  }
  return unique(hits);
}

export function stripProductName(title: string): string {
  const structural = stripVariantFromTitle(title);
  const normalized = normalize(structural);
  const terms = ["oversized", "heavyweight", "hoodie", "tee", "t-shirt", "sweatshirt", "zip", "long sleeve"];
  const hits = terms.filter((term) => normalized.includes(term));
  if (hits.length > 0) {
    return hits.map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase())).join(" ");
  }
  const parts = structural.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ").trim() : structural;
}

export { isCatalogProductReference as isExistingCatalogProduct } from "./catalog-filter";

function buildPerformance(commerce?: CommerceProductRecord): HistoricalPerformance {
  const performance: HistoricalPerformance = {};
  if (commerce?.unitsSold != null && commerce.unitsSold > 0) {
    performance.sales = commerce.unitsSold;
  }
  return performance;
}

function deriveColors(product: ShopifyKnowledgeProduct): string[] {
  if (!product.colors?.length) {
    const fromTitle = matchFromMap(normalize(product.title), COLOR_MAP);
    return fromTitle.length > 0 ? fromTitle : [];
  }
  return unique(
    product.colors.map((color) => COLOR_MAP[normalize(color)] ?? color),
  );
}

function dimensionEvidence(
  dimension: PatternDimension,
  traits: string[],
  product: ShopifyKnowledgeProduct,
  commerce?: CommerceProductRecord,
): string[] {
  if (traits.length === 0) return [INSUFFICIENT_SHOPIFY_EVIDENCE];

  const evidence: string[] = [];
  switch (dimension) {
    case "typography":
      if (product.tags?.some((t) => /minimal|serif|sans|typography|letter/i.test(t))) {
        evidence.push(`Shopify-Tags bestätigen Typografie: ${traits.join(", ")}.`);
      }
      break;
    case "placement":
      if (product.tags?.some((t) => /back|chest|embroidery|print|spine/i.test(t))) {
        evidence.push(`Shopify-Metadaten bestätigen Platzierung: ${traits.join(", ")}.`);
      }
      break;
    case "colorWorld":
      if (product.colors?.length) {
        evidence.push(`Shopify-Variantenfarben: ${product.colors.slice(0, 3).join(", ")}.`);
      }
      break;
    case "printTechnique":
      if (product.tags?.some((t) => /screen|embroidery|dtg|print/i.test(t))) {
        evidence.push(`Shopify-Druckmetadaten: ${traits.join(", ")}.`);
      }
      break;
    case "material":
      if (product.materials?.length || /\d{3}\s*gsm/i.test(product.tags?.join(" ") ?? "")) {
        evidence.push(`Shopify-Materialfelder: ${traits.join(", ")}.`);
      }
      break;
    case "graphicStyle":
      if (product.tags?.some((t) => /archive|texture|minimal|luxury|graphic/i.test(t))) {
        evidence.push(`Shopify-Grafik-Tags: ${traits.join(", ")}.`);
      }
      break;
    case "silhouette":
      evidence.push(`Silhouette aus Produkttyp/Titel abgeleitet: ${traits.join(", ")}.`);
      break;
    default:
      if (product.tags?.length) {
        evidence.push(`Shopify-Tags unterstützen ${dimension}: ${traits.slice(0, 2).join(", ")}.`);
      }
  }

  if (evidence.length === 0) return [INSUFFICIENT_SHOPIFY_EVIDENCE];
  if (commerce?.unitsSold && dimension === "silhouette") {
    evidence.push(`${commerce.unitsSold} verkaufte Einheiten (Shopify).`);
  }
  return evidence.slice(0, 2);
}

export function extractPatternFromProduct(
  product: ShopifyKnowledgeProduct,
  commerce?: CommerceProductRecord,
): ExtractedProductPattern {
  const tags = product.tags ?? [];
  const tagCorpus = normalize(tags.join(" "));
  const titleCorpus = normalize(stripVariantFromTitle(product.title));
  const structuredMaterials = parseStructuredMaterials([
    ...(product.materials ?? []),
    ...tags.filter((tag) => /\d{3}\s*gsm|heavyweight|cotton|fleece/i.test(tag)),
  ]);

  const typography = matchFromMap(tagCorpus, TYPOGRAPHY_TAGS);
  const placement = matchFromMap(tagCorpus, PLACEMENT_TAGS);
  const colorWorld = deriveColors(product);
  const graphicStyle = matchFromMap(tagCorpus, GRAPHIC_TAGS);
  const printTechnique = matchFromMap(tagCorpus, PRINT_TAGS);
  const material = structuredMaterials;
  const silhouette = stripProductName(product.title) ? [stripProductName(product.title)] : [];

  const patterns: Partial<Record<PatternDimension, string[]>> = {};
  const dimensionEvidenceMap: Partial<Record<PatternDimension, string[]>> = {};

  const assign = (dimension: PatternDimension, traits: string[]) => {
    if (traits.length === 0) return;
    patterns[dimension] = traits;
    dimensionEvidenceMap[dimension] = dimensionEvidence(dimension, traits, product, commerce);
  };

  assign("typography", typography);
  assign("placement", placement);
  assign("colorWorld", colorWorld);
  assign("graphicStyle", graphicStyle);
  assign("printTechnique", printTechnique);
  assign("material", material);
  assign("silhouette", silhouette);

  const whySuccessful: string[] = [];
  if (commerce?.unitsSold) {
    whySuccessful.push(`${commerce.unitsSold} verkaufte Einheiten in Shopify-Bestelldaten.`);
  }
  if (commerce?.revenue) {
    whySuccessful.push(
      `${Math.round(commerce.revenue)} ${commerce.currency ?? "EUR"} Umsatz in Shopify-Bestelldaten.`,
    );
  }

  return {
    sourceProductId: product.id,
    patterns,
    dimensionEvidence: dimensionEvidenceMap,
    whySuccessful: whySuccessful.slice(0, 2),
    historicalPerformance: buildPerformance(commerce),
    unitsSold: commerce?.unitsSold ?? 0,
    revenue: commerce?.revenue ?? 0,
  };
}

export function extractPatternsFromCatalog(
  products: ShopifyKnowledgeProduct[],
  commerceById: Record<string, CommerceProductRecord>,
  limit = 12,
): ExtractedProductPattern[] {
  const ranked = [...products]
    .map((product) => ({
      product,
      commerce: commerceById[product.id],
    }))
    .sort(
      (a, b) =>
        (b.commerce?.unitsSold ?? 0) - (a.commerce?.unitsSold ?? 0) ||
        (b.commerce?.revenue ?? 0) - (a.commerce?.revenue ?? 0),
    )
    .slice(0, limit);

  return ranked.map(({ product, commerce }) =>
    extractPatternFromProduct(product, commerce),
  );
}

export function normalizeProductReference(text: string): string {
  return normalizeCatalogReference(text);
}
