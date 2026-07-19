import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";

export interface CatalogReferenceIndex {
  productIds: Set<string>;
  titles: string[];
  normalizedTitles: Set<string>;
  baseTitles: Set<string>;
  collectionNames: Set<string>;
  catalogTags: Set<string>;
  handles: Set<string>;
}

const VARIANT_SUFFIX_RE =
  /\s*[-–—|]\s*(xs|s|m|l|xl|xxl|2xl|3xl|\d+)\b.*$/i;
const COLOR_VARIANT_RE =
  /\s*[-–—|]\s*(weiß|weiss|white|black|schwarz|rot|red|grau|grey|gray|stone|cream).*$/i;

export function normalizeProductReference(text: string): string {
  return text
    .toLowerCase()
    .replace(VARIANT_SUFFIX_RE, "")
    .replace(COLOR_VARIANT_RE, "")
    .replace(/[^a-z0-9äöüß\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripVariantFromTitle(title: string): string {
  return title
    .replace(VARIANT_SUFFIX_RE, "")
    .replace(COLOR_VARIANT_RE, "")
    .replace(/\s*\/\s*[a-zäöüß]+\s*$/i, "")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeProductReference(text)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function overlapRatio(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function buildCatalogReferenceIndex(
  products: ShopifyKnowledgeProduct[],
  collectionNames: string[] = [],
  extraTags: string[] = [],
): CatalogReferenceIndex {
  const productIds = new Set<string>();
  const titles: string[] = [];
  const normalizedTitles = new Set<string>();
  const baseTitles = new Set<string>();
  const handles = new Set<string>();

  for (const product of products) {
    productIds.add(product.id);
    titles.push(product.title);
    normalizedTitles.add(normalizeProductReference(product.title));
    baseTitles.add(normalizeProductReference(stripVariantFromTitle(product.title)));
    if (product.handle) handles.add(normalizeProductReference(product.handle));
    for (const tag of product.tags ?? []) {
      normalizedTitles.add(normalizeProductReference(tag));
    }
  }

  return {
    productIds,
    titles,
    normalizedTitles,
    baseTitles,
    collectionNames: new Set(collectionNames.map(normalizeProductReference)),
    catalogTags: new Set(extraTags.map(normalizeProductReference)),
    handles,
  };
}

function resolveCatalogIndex(
  index: CatalogReferenceIndex | readonly string[],
): CatalogReferenceIndex {
  if (typeof index === "object" && index !== null && "productIds" in index) {
    return index;
  }
  return buildCatalogReferenceIndex(
    (index as readonly string[]).map((title, i) => ({
      id: `legacy-${i}`,
      title,
      handle: "",
      status: "ACTIVE",
      productType: "",
      price: "0",
      currency: "EUR",
      inventory: 0,
      collections: [],
      tags: [],
      colors: [],
      materials: [],
    })),
  );
}

export function isCatalogProductReference(
  label: string,
  index: CatalogReferenceIndex | readonly string[],
): boolean {
  if (!label?.trim()) return false;

  const catalogIndex = resolveCatalogIndex(index);

  const normalized = normalizeProductReference(label);
  const base = normalizeProductReference(stripVariantFromTitle(label));
  if (!normalized) return false;

  if (catalogIndex.normalizedTitles.has(normalized)) return true;
  if (catalogIndex.baseTitles.has(base)) return true;
  if (catalogIndex.handles.has(normalized)) return true;

  for (const title of catalogIndex.titles) {
    const catalogNorm = normalizeProductReference(title);
    const catalogBase = normalizeProductReference(stripVariantFromTitle(title));
    if (
      normalized === catalogNorm ||
      base === catalogBase ||
      normalized.includes(catalogNorm) ||
      catalogNorm.includes(normalized) ||
      overlapRatio(label, title) >= 0.72
    ) {
      return true;
    }
  }

  for (const collection of catalogIndex.collectionNames) {
    if (collection && (normalized === collection || normalized.includes(collection))) {
      return true;
    }
  }

  return false;
}

export function isCollectionConceptForCatalogProduct(
  label: string,
  index: CatalogReferenceIndex,
): boolean {
  if (!/collection concept/i.test(label)) return false;
  const anchor = label
    .replace(/collection concept.*/i, "")
    .replace(/^.*?\b([a-z0-9\s-]+)\s+collection.*/i, "$1")
    .trim();
  return isCatalogProductReference(anchor, index) || isCatalogProductReference(label, index);
}

export function convertProductReferenceToPatternLabel(
  title: string,
  traits?: { typography?: string[]; material?: string[]; silhouette?: string[] },
): string {
  const structural = stripVariantFromTitle(title);
  const typography = traits?.typography?.[0] ?? "Minimal";
  const material = traits?.material?.find((m) => /heavyweight|gsm|cotton/i.test(m)) ?? "Heavyweight";
  const silhouette =
    traits?.silhouette?.[0] ??
    (/\bhoodie\b/i.test(structural) ? "hoodies" : "oversized tees");
  return `${typography} typography on ${material.toLowerCase()} ${silhouette.toLowerCase()}`;
}

/** @deprecated Use isCatalogProductReference with CatalogReferenceIndex */
export function isExistingCatalogProduct(
  title: string,
  catalogTitles: readonly string[],
): boolean {
  return isCatalogProductReference(title, catalogTitles);
}
