import { deriveShopifyProductSourceContext, PRODUCT_SOURCE_OWNER_LABELS } from "@/lib/product-library/product-source-context";
import { normalizeProductShotKind, type ProductShotKind } from "@/lib/image/content-packs";

const COLOR_OPTION_NAMES = /^(color|colour|farbe|couleur)$/i;
const SIZE_OPTION_NAMES = /^(size|größe|groesse|taille)$/i;

const GARMENT_WORD =
  /(?:heavy\s+|oversized\s+|zip\s+|premium\s+)*(?:hoodie|zip\s*hoodie|tee|t-?shirt|jogger|sweatshirt|headwear|cap|pants|jacket|crewneck|sweater)\b/i;

export type ShopifyGarmentCatalogProduct = {
  id: string;
  title: string;
  productType: string;
  vendor?: string | null;
  tags?: string[];
  active?: boolean;
  variantColors?: string[];
  variantSizes?: string[];
  variants: Array<{
    id: string;
    title: string;
    availableForSale: boolean;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
};

export type GarmentFamily = {
  key: string;
  label: string;
  productType: string;
  shotKind: ProductShotKind;
  productIds: string[];
  colors: string[];
  sizes: string[];
  sourceLabel: string | null;
};

function optionValue(
  selectedOptions: Array<{ name: string; value: string }>,
  matcher: RegExp,
): string | null {
  return (
    selectedOptions.find((option) => matcher.test(option.name.trim()))?.value.trim() ||
    null
  );
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("de-DE") + part.slice(1))
    .join(" ");
}

function looksLikeGarmentName(value: string): boolean {
  return GARMENT_WORD.test(value.trim());
}

/** Strip design-specific Shopify listing prefixes and keep the physical garment phrase. */
export function extractGarmentPhraseFromTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;

  if (trimmed.includes(" - ")) {
    const suffix = trimmed.split(" - ").pop()?.trim() ?? "";
    if (suffix && looksLikeGarmentName(suffix)) return suffix;
  }

  const trailing = trimmed.match(
    /((?:Heavy\s+|Oversized\s+|Zip\s+|Premium\s+)*?(?:Zip Hoodie|Hoodie|T-?Shirt|Tee|Jogger|Sweatshirt|Headwear|Cap|Pants|Jacket|Crewneck|Sweater)\b.*)$/i,
  )?.[1]?.trim();
  if (trailing && looksLikeGarmentName(trailing)) return trailing;

  return looksLikeGarmentName(trimmed) ? trimmed : null;
}

/** Owner-facing garment family label. Never uses design-only prefixes as primary truth. */
export function normalizeGarmentFamilyLabel(
  title: string,
  productType: string,
): string {
  const type = productType.trim();
  const fromTitle = extractGarmentPhraseFromTitle(title);

  if (fromTitle) {
    if (
      type &&
      type !== "Uncategorized" &&
      !/^t-?shirts?$/i.test(type) &&
      looksLikeGarmentName(type) &&
      type.length >= fromTitle.length
    ) {
      return titleCase(type);
    }
    return titleCase(fromTitle);
  }

  if (type && type !== "Uncategorized") return titleCase(type);
  return titleCase(title.trim() || "Produkt");
}

export function deriveGarmentFamilyKey(title: string, productType: string): string {
  const label = normalizeGarmentFamilyLabel(title, productType);
  const shotKind = normalizeProductShotKind(`${label} ${productType}`);
  return `${shotKind}::${label.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim()}`;
}

function collectVariantColors(product: ShopifyGarmentCatalogProduct): string[] {
  const colors = new Set<string>();
  for (const color of product.variantColors ?? []) {
    const trimmed = color.trim();
    if (trimmed) colors.add(trimmed);
  }
  for (const variant of product.variants) {
    const color = optionValue(variant.selectedOptions, COLOR_OPTION_NAMES);
    if (color) colors.add(color);
  }
  return [...colors].sort((a, b) => a.localeCompare(b, "de-DE"));
}

function collectVariantSizes(product: ShopifyGarmentCatalogProduct): string[] {
  const sizes = new Set<string>();
  for (const size of product.variantSizes ?? []) {
    const trimmed = size.trim();
    if (trimmed) sizes.add(trimmed);
  }
  for (const variant of product.variants) {
    const size = optionValue(variant.selectedOptions, SIZE_OPTION_NAMES);
    if (size) sizes.add(size);
  }
  return [...sizes].sort((a, b) => a.localeCompare(b, "de-DE"));
}

function mergeUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de-DE"),
  );
}

function familySourceLabel(products: ShopifyGarmentCatalogProduct[]): string | null {
  const providers = new Set<string>();
  for (const product of products) {
    const source = deriveShopifyProductSourceContext({
      vendor: product.vendor,
      tags: product.tags,
      capturedAt: new Date().toISOString(),
    });
    if (source.sourceProvider !== "UNKNOWN") {
      providers.add(PRODUCT_SOURCE_OWNER_LABELS[source.sourceProvider]);
    }
  }
  if (providers.size === 1) return [...providers][0] ?? null;
  return null;
}

export function groupShopifyProductsIntoGarmentFamilies(
  products: readonly ShopifyGarmentCatalogProduct[],
): GarmentFamily[] {
  const grouped = new Map<string, { label: string; productType: string; products: ShopifyGarmentCatalogProduct[] }>();

  for (const product of products) {
    const key = deriveGarmentFamilyKey(product.title, product.productType);
    const label = normalizeGarmentFamilyLabel(product.title, product.productType);
    const existing = grouped.get(key);
    if (existing) {
      existing.products.push(product);
      if (label.length > existing.label.length) existing.label = label;
    } else {
      grouped.set(key, {
        label,
        productType: product.productType,
        products: [product],
      });
    }
  }

  return [...grouped.entries()]
    .map(([key, entry]) => {
      const colors = mergeUnique(entry.products.flatMap(collectVariantColors));
      const sizes = mergeUnique(entry.products.flatMap(collectVariantSizes));
      return {
        key,
        label: entry.label,
        productType: entry.productType,
        shotKind: normalizeProductShotKind(`${entry.label} ${entry.productType}`),
        productIds: entry.products.map((product) => product.id),
        colors,
        sizes,
        sourceLabel: familySourceLabel(entry.products),
      } satisfies GarmentFamily;
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));
}

export function findGarmentFamily(
  families: readonly GarmentFamily[],
  familyKey: string,
): GarmentFamily | null {
  return families.find((family) => family.key === familyKey) ?? null;
}

export function listSizesForGarmentFamilyColor(
  products: readonly ShopifyGarmentCatalogProduct[],
  family: GarmentFamily,
  color: string,
): string[] {
  const familyProducts = products.filter((product) => family.productIds.includes(product.id));
  const sizes = new Set<string>();
  for (const product of familyProducts) {
    for (const variant of product.variants) {
      const variantColor = optionValue(variant.selectedOptions, COLOR_OPTION_NAMES);
      const variantSize = optionValue(variant.selectedOptions, SIZE_OPTION_NAMES);
      if (!variantSize || !variantColor) continue;
      if (variantColor.localeCompare(color, "de-DE", { sensitivity: "accent" }) !== 0) continue;
      sizes.add(variantSize);
    }
  }
  return [...sizes].sort((a, b) => a.localeCompare(b, "de-DE"));
}

export function resolveShopifyVariantForGarmentSelection(input: {
  products: readonly ShopifyGarmentCatalogProduct[];
  family: GarmentFamily;
  color: string;
  size: string;
}): { productId: string; variantId: string } | null {
  const familyProducts = input.products.filter((product) =>
    input.family.productIds.includes(product.id),
  );
  const matches: Array<{ productId: string; variantId: string; availableForSale: boolean }> = [];

  for (const product of familyProducts) {
    for (const variant of product.variants) {
      const variantColor = optionValue(variant.selectedOptions, COLOR_OPTION_NAMES);
      const variantSize = optionValue(variant.selectedOptions, SIZE_OPTION_NAMES);
      if (!variantColor || !variantSize) continue;
      if (
        variantColor.localeCompare(input.color, "de-DE", { sensitivity: "accent" }) !== 0 ||
        variantSize.localeCompare(input.size, "de-DE", { sensitivity: "accent" }) !== 0
      ) {
        continue;
      }
      matches.push({
        productId: product.id,
        variantId: variant.id,
        availableForSale: variant.availableForSale,
      });
    }
  }

  if (!matches.length) return null;
  const preferred =
    matches.find((match) => match.availableForSale) ?? matches[0] ?? null;
  return preferred
    ? { productId: preferred.productId, variantId: preferred.variantId }
    : null;
}

export function formatGarmentFamilyOptionLabel(family: GarmentFamily): string {
  return family.label;
}

export function formatGarmentFamilySecondaryLabel(family: GarmentFamily): string | null {
  const parts = [
    family.sourceLabel,
    "Shopify verifiziert",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Shopify verifiziert";
}
