import {
  buildProductGenerationConstraints,
  getAllowedProductTypes,
  getForbiddenProductTypes,
  getHeroProducts,
  isProductGenerationEligible,
} from "./rules";
import type {
  Product,
  ProductCatalog,
  ProductGenerationConstraints,
  ProductIntelligenceSnapshot,
} from "./types";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function eligibleProducts(catalog: ProductCatalog): Product[] {
  return catalog.products.filter(isProductGenerationEligible);
}

function sourceHonestyLines(catalog: ProductCatalog): string[] {
  const sync = catalog.sync;
  const usingSeed = sync?.usingSeedFallback ?? catalog.source === "seed";
  const source = sync?.catalogSource ?? catalog.source;

  if (source === "shopify_live" && sync?.liveCatalogAvailable) {
    return [
      `Catalog Source:\nshopify_live (confirmed from Shopify)`,
      `Live Catalog Available:\ntrue`,
      `Using Seed Fallback:\nfalse`,
    ];
  }

  if (usingSeed) {
    return [
      `Catalog Source:\nseed fallback (not live Shopify truth)`,
      `Live Catalog Available:\nfalse`,
      `Using Seed Fallback:\ntrue`,
      "Honesty: seed assumptions are generation direction only — not confirmed Shopify inventory, SKUs, or stock.",
    ];
  }

  return [
    `Catalog Source:\n${source}`,
    `Using Seed Fallback:\n${usingSeed}`,
  ];
}

/**
 * Full Product Intelligence block for studio system prompts.
 * Deterministic field order. Explicitly forbids invented products.
 */
export function formatProductIntelligencePrompt(
  catalog: ProductCatalog,
): string {
  const eligible = eligibleProducts(catalog);
  const heroes = getHeroProducts(catalog);

  const productLines = eligible.map((p) => {
    const colors =
      p.availableColors.length > 0
        ? p.availableColors.map((c) => c.name).join(", ")
        : "unknown until Shopify sync";
    const sizes =
      p.availableSizes.length > 0
        ? p.availableSizes.map((s) => s.label).join(", ")
        : "unknown until Shopify sync";
    const hero = p.heroProduct ? " hero=yes" : "";
    return `- ${p.title} [${p.id}] type="${p.productType}" category=${p.category} colors=[${colors}] sizes=[${sizes}] source=${p.source} confidence=${p.confidence}${hero}`;
  });

  return [
    "## PRODUCT INTELLIGENCE",
    "",
    `Brand:\n${catalog.brandName}`,
    "",
    `Catalog Version:\n${catalog.version}`,
    "",
    ...sourceHonestyLines(catalog),
    "",
    `Allowed Product Types:\n${joinList(getAllowedProductTypes(catalog))}`,
    "",
    `Forbidden Product Types:\n${joinList(getForbiddenProductTypes(catalog))}`,
    "",
    `Forbidden Categories:\n${joinList(catalog.forbiddenCategories)}`,
    "",
    `Hero Products:\n${heroes.map((p) => `${p.title} (${p.id})`).join("; ") || "(none)"}`,
    "",
    "Generation-Eligible Products:",
    ...productLines,
    "",
    "Rules:",
    "- Only generate products that exist in this catalog.",
    "- Never invent product types, colors, sizes, accessories, or variants.",
    "- Caps, jackets, jewelry, suits, footwear, and accessories are forbidden unless explicitly listed as eligible products.",
    "- When catalog source is seed fallback, do not claim live Shopify confirmation.",
    "- Unknown colors/sizes/variants must stay unknown — never invent them.",
    ...catalog.notes.map((n) => `- ${n}`),
  ].join("\n");
}

/**
 * Compact constraint block for generation jobs.
 */
export function formatProductConstraintsPrompt(
  catalogOrConstraints: ProductCatalog | ProductGenerationConstraints,
): string {
  const isCatalog =
    "products" in catalogOrConstraints && "brandSlug" in catalogOrConstraints;
  const constraints = isCatalog
    ? buildProductGenerationConstraints(catalogOrConstraints as ProductCatalog)
    : (catalogOrConstraints as ProductGenerationConstraints);

  const colorLines = Object.entries(constraints.allowedColorsByProductId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, colors]) =>
      colors.length > 0
        ? `- ${productId}: ${joinList(colors)}`
        : `- ${productId}: (unknown until Shopify sync)`,
    );

  const sourceLine = constraints.usingSeedFallback
    ? `Catalog Source:\nseed fallback (not live Shopify truth)`
    : `Catalog Source:\n${constraints.catalogSource}`;

  return [
    "## PRODUCT GENERATION CONSTRAINTS",
    "",
    sourceLine,
    "",
    `Using Seed Fallback:\n${constraints.usingSeedFallback}`,
    "",
    `Allowed Product Types:\n${joinList(constraints.allowedProductTypes)}`,
    "",
    `Forbidden Product Types:\n${joinList(constraints.forbiddenProductTypes)}`,
    "",
    `Forbidden Categories:\n${joinList(constraints.forbiddenCategories)}`,
    "",
    `Hero Product IDs:\n${joinList(constraints.heroProductIds)}`,
    "",
    `Generation-Eligible Product IDs:\n${joinList(constraints.generationEligibleProductIds)}`,
    "",
    "Allowed Colors By Product:",
    ...colorLines,
    "",
    `Never Generate:\n${joinList(constraints.neverGenerate)}`,
    "",
    "Hard rules: do not invent product types, colors, accessories, or variants outside this list.",
    constraints.usingSeedFallback
      ? "Seed fallback: treat listed products as direction only — not confirmed live Shopify SKUs."
      : "Shopify live: prefer confirmed catalog facts only.",
  ].join("\n");
}

/**
 * Variant-focused block for a single product (Image / Shopify studios).
 */
export function formatProductVariantPrompt(
  catalog: ProductCatalog,
  productId: string,
): string {
  const product = catalog.products.find((p) => p.id === productId);
  if (!product) {
    return [
      "## PRODUCT VARIANTS",
      "",
      `Product "${productId}" not found.`,
      "Do not invent variants. Abort product-specific generation.",
    ].join("\n");
  }

  const variantLines = product.variants
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((v) => {
      const color = product.availableColors.find((c) => c.id === v.colorId);
      const size = product.availableSizes.find((s) => s.id === v.sizeId);
      return `- ${v.id}: ${color?.name ?? v.colorId} / ${size?.label ?? v.sizeId} active=${v.active} sellable=${v.sellable} availability=${v.availability} confidence=${v.confidence}`;
    });

  return [
    "## PRODUCT VARIANTS",
    "",
    `Product:\n${product.title} [${product.id}]`,
    "",
    `Type:\n${product.productType}`,
    "",
    `Source / Confidence:\n${product.source} / ${product.confidence}`,
    "",
    `Colors:\n${
      product.availableColors.length > 0
        ? joinList(product.availableColors.map((c) => c.name))
        : "(unknown until Shopify sync)"
    }`,
    "",
    `Sizes:\n${
      product.availableSizes.length > 0
        ? joinList(product.availableSizes.map((s) => s.label))
        : "(unknown until Shopify sync)"
    }`,
    "",
    "Variants:",
    ...(variantLines.length > 0
      ? variantLines
      : ["- (no confirmed variants — do not invent SKUs)"]),
    "",
    "Only use listed variants. Never invent colors, sizes, or SKUs.",
  ].join("\n");
}

/**
 * Persona Stage A wardrobe constraints from Product Intelligence.
 * Categories + colors only — no inventory, sizes, or SKU dependency.
 */
export function formatProductWardrobeConstraintsForPersona(
  catalog: ProductCatalog | ProductIntelligenceSnapshot,
): string {
  const productCatalog = "catalog" in catalog ? catalog.catalog : catalog;
  const constraints = buildProductGenerationConstraints(productCatalog);
  const products = productCatalog.products.filter(isProductGenerationEligible);

  const wardrobeLines = products.map((p) => {
    const colors =
      p.availableColors.length > 0
        ? p.availableColors.map((c) => c.name).join(", ")
        : "unknown until Shopify sync";
    return `- ${p.productType}: colors [${colors}]`;
  });

  const sourceNote = constraints.usingSeedFallback
    ? "Catalog source: seed fallback (not live Shopify truth)."
    : `Catalog source: ${constraints.catalogSource}.`;

  return [
    "PRODUCT INTELLIGENCE WARDROBE (authoritative — not Brand Memory catalog):",
    sourceNote,
    `Allowed garments: ${joinList(constraints.allowedProductTypes)}.`,
    ...wardrobeLines,
    `Forbidden categories: ${joinList(constraints.forbiddenCategories)}.`,
    `Never generate: caps, jackets, jewelry, suits, footwear, or accessories unless listed above.`,
    "Stage A casting: use garment category + color only — ignore sizes, SKUs, and inventory.",
    "Do not invent colors for products marked unknown until Shopify sync.",
  ].join("\n");
}
