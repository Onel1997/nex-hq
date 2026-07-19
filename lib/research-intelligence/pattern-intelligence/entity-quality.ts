import {
  isCatalogProductReference,
  normalizeProductReference,
  type CatalogReferenceIndex,
} from "./catalog-filter";

export type EntityClassification =
  | "trend"
  | "design_pattern"
  | "product"
  | "category"
  | "catalog_metadata"
  | "noise"
  | "recommendation";

const NOISE_TERMS = new Set([
  "all",
  "brand",
  "collection",
  "product",
  "shop",
  "access",
  "acces",
  "accessoires",
  "accessories",
  "hut",
  "mütze",
  "muetze",
  "red",
  "rot",
  "new",
  "sale",
  "default",
  "uncategorized",
  "misc",
  "other",
  "test",
  "sku",
  "variant",
  "handle",
]);

const CATALOG_METADATA_TERMS = new Set([
  "all",
  "brand",
  "collection",
  "accessoires",
  "accessories",
  "hut",
  "mütze",
  "muetze",
  "red",
  "rot",
]);

const VARIANT_TITLE_RE =
  /\s[-–—|/]\s*(xs|s|m|l|xl|xxl|2xl|3xl|\d+)\b/i;
const SKU_RE = /^[A-Z0-9]{2,}[-_][A-Z0-9]+$/i;

export function isNoiseEntity(label: string): boolean {
  const normalized = normalizeProductReference(label);
  if (!normalized) return true;
  if (normalized.length < 4) return true;
  if (NOISE_TERMS.has(normalized)) return true;

  const tokens = normalized.split(/\s+/);
  if (tokens.length === 1 && tokens[0].length < 4) return true;
  if (tokens.every((token) => NOISE_TERMS.has(token))) return true;

  if (isMalformedTagDump(label)) return true;
  if (isVariantTitle(label)) return true;
  if (SKU_RE.test(label.trim())) return true;
  if (/\.\.$/.test(label.trim())) return true;
  if (/\bacces\.{1,}$/i.test(label.trim())) return true;

  return false;
}

export function isVariantTitle(label: string): boolean {
  return VARIANT_TITLE_RE.test(label) || /\s\/\s*(weiß|weiss|white|schwarz|black)/i.test(label);
}

export function isMalformedTagDump(label: string): boolean {
  const commas = (label.match(/,/g) ?? []).length;
  if (commas >= 3) return true;
  if (label.length > 120) return true;
  if (/\b(xs|s|m|l|xl)\b.*\b(xs|s|m|l|xl)\b/i.test(label) && /versand|dhl|liefer/i.test(label)) {
    return true;
  }
  return false;
}

export function isCatalogMetadata(label: string): boolean {
  const normalized = normalizeProductReference(label);
  if (CATALOG_METADATA_TERMS.has(normalized)) return true;
  if (/^collection\s+(handle|name)/i.test(label)) return true;
  return false;
}

export function classifyEntity(
  label: string,
  catalogIndex: CatalogReferenceIndex,
): EntityClassification {
  if (isNoiseEntity(label)) return "noise";
  if (isCatalogProductReference(label, catalogIndex)) return "product";
  if (isCatalogMetadata(label)) return "catalog_metadata";
  if (/collection concept/i.test(label)) return "recommendation";
  if (/pattern|typography|placement|embroidery|print|graphic theme|design direction/i.test(label)) {
    return "design_pattern";
  }
  if (/quiet luxury|archive|minimal|trend|momentum/i.test(label)) return "trend";
  if (/^shorts$|^pants$|^jacket$|^hoodie$|^tee$/i.test(normalizeProductReference(label))) {
    return "category";
  }
  if (/shorts|pants|hoodie|tee|accessory|jacket|category|gap/i.test(label)) {
    return "category";
  }
  return "recommendation";
}

export function isCreativeOpportunityEntity(kind: EntityClassification): boolean {
  return kind === "trend" || kind === "design_pattern";
}

export function normalizeEntityLabel(label: string): string {
  return normalizeProductReference(
    label
      .replace(/^Explore "|" as a design direction$/g, "")
      .replace(/^Product signal:\s*/i, "")
      .replace(/^Graphic theme:\s*/i, "")
      .replace(/^Color palette direction:\s*/i, "")
      .trim(),
  );
}

export function dedupeByNormalizedLabel<T extends { title?: string; label?: string; id?: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const raw = item.title ?? item.label ?? item.id ?? "";
    const key = normalizeEntityLabel(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function passesOpportunityQualityGate(
  label: string,
  catalogIndex: CatalogReferenceIndex,
): boolean {
  if (isNoiseEntity(label)) return false;
  if (isCatalogMetadata(label)) return false;
  if (isCatalogProductReference(label, catalogIndex)) return false;
  if (isVariantTitle(label)) return false;
  const kind = classifyEntity(label, catalogIndex);
  return isCreativeOpportunityEntity(kind);
}
