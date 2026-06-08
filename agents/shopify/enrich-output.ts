import { SHOPIFY_REPORT_TYPE } from "@/brain/domains/reports";
import type { ShopifyProduct, ShopifyProductVariant } from "./types";

const MIN_COLLECTION_DESC = 80;
const MIN_PRODUCT_DESC = 40;
const MIN_FULL_DRAFT = 800;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function ensureMinLength(text: string, min: number, suffix: string): string {
  let result = text.trim() || suffix.trim();
  while (result.length < min) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

function defaultVariants(productName: string): ShopifyProductVariant[] {
  return [
    {
      optionName: "Größe",
      optionValues: ["S", "M", "L", "XL"],
      sku: `${productName.slice(0, 8).toUpperCase()}-STD`,
    },
  ];
}

function normalizeProduct(entry: unknown, index: number): ShopifyProduct | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const productName =
    asString(obj.productName) || asString(obj.name) || `Produkt ${index + 1}`;
  const category = asString(obj.category) || "Streetwear";
  const tags = asStringArray(obj.tags);

  const variantRaw = Array.isArray(obj.variants) ? obj.variants : [];
  const variants: ShopifyProductVariant[] = [];
  for (const v of variantRaw) {
    const variant = asRecord(v);
    if (!variant) continue;
    const optionName = asString(variant.optionName) || "Größe";
    const optionValues = asStringArray(variant.optionValues);
    if (optionValues.length === 0) continue;
    const entry: ShopifyProductVariant = {
      optionName,
      optionValues,
    };
    const sku = asString(variant.sku);
    const price = asString(variant.price);
    if (sku) entry.sku = sku;
    if (price) entry.price = price;
    variants.push(entry);
  }

  return {
    productName,
    productType: asString(obj.productType) || category,
    category,
    description: ensureMinLength(
      asString(obj.description),
      MIN_PRODUCT_DESC,
      `Produktbeschreibung aus Design-Bericht für ${productName}.`,
    ),
    shortDescription: ensureMinLength(
      asString(obj.shortDescription),
      20,
      `Kurzbeschreibung für ${productName} aus Design-Intelligence.`,
    ),
    materials: ensureMinLength(
      asString(obj.materials),
      10,
      "Materialien aus Design-Bericht.",
    ),
    tags: tags.length >= 2 ? tags : [category, "drop", "limited"],
    seoTitle: ensureMinLength(
      asString(obj.seoTitle),
      10,
      `${productName} | Kollektion`,
    ).slice(0, 70),
    seoDescription: ensureMinLength(
      asString(obj.seoDescription),
      50,
      `Shopify-Listing für ${productName} basierend auf Design- und Marketing-Berichten.`,
    ).slice(0, 320),
    suggestedPrice: asString(obj.suggestedPrice) || "TBD",
    compareAtPrice: asString(obj.compareAtPrice) || undefined,
    variants: variants.length > 0 ? variants : defaultVariants(productName),
    inventoryRecommendation: ensureMinLength(
      asString(obj.inventoryRecommendation),
      20,
      "Bestandsmenge aus CEO- und Marketing-Launch-Plan ableiten.",
    ),
  };
}

function buildFullDraft(payload: Record<string, unknown>): string {
  const title = asString(payload.title) || "Shopify-Storefront-Entwurf";
  const products = Array.isArray(payload.products) ? payload.products : [];

  const sections = [
    `# ${title}`,
    "## Kollektion",
    `**${asString(payload.collectionName)}**`,
    asString(payload.collectionDescription),
    "## SEO",
    `Title: ${asString(payload.collectionSeoTitle)}`,
    `Description: ${asString(payload.collectionSeoDescription)}`,
    "## Produkte",
    ...products.map((p) => {
      const product = asRecord(p);
      if (!product) return "";
      return `### ${asString(product.productName)}\n${asString(product.description)}`;
    }),
    "## Launch-Checkliste",
    ...asStringArray(payload.launchChecklist).map((item) => `- ${item}`),
    "## Storefront-Warnungen",
    ...asStringArray(payload.storefrontWarnings).map((item) => `- ${item}`),
  ];

  return ensureMinLength(
    sections.filter(Boolean).join("\n\n"),
    MIN_FULL_DRAFT,
    "Vollständiger Shopify-Storefront-Entwurf basierend auf Design- und Marketing-Intelligence.",
  );
}

export function enrichShopifyPayload(
  payload: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  if (!payload.reportType) {
    payload.reportType = SHOPIFY_REPORT_TYPE;
    adjustments.push("set reportType=shopify-report");
  }

  const title = asString(payload.title) || "Shopify-Storefront-Entwurf";
  if (!asString(payload.title)) {
    payload.title = title;
    adjustments.push("generated title");
  }

  const collectionName =
    asString(payload.collectionName) || "Neue Kollektion";
  if (!asString(payload.collectionName)) {
    payload.collectionName = collectionName;
    adjustments.push("generated collectionName");
  }

  if (
    !asString(payload.collectionDescription) ||
    asString(payload.collectionDescription).length < MIN_COLLECTION_DESC
  ) {
    payload.collectionDescription = ensureMinLength(
      asString(payload.collectionDescription) ||
        `Storefront-Kollektion "${collectionName}" aus Design- und Marketing-Berichten.`,
      MIN_COLLECTION_DESC,
      "Kollektionsbeschreibung leitet sich aus Design-Intelligence ab.",
    );
    adjustments.push("enriched collectionDescription");
  }

  if (!asString(payload.collectionSeoTitle)) {
    payload.collectionSeoTitle = `${collectionName} | Drop`.slice(0, 70);
    adjustments.push("generated collectionSeoTitle");
  }

  if (
    !asString(payload.collectionSeoDescription) ||
    asString(payload.collectionSeoDescription).length < 50
  ) {
    payload.collectionSeoDescription = ensureMinLength(
      asString(payload.collectionSeoDescription) ||
        `Entdecke ${collectionName} — limitierter Drop basierend auf Brand-Intelligence.`,
      50,
      "SEO aus Marketing- und Design-Berichten.",
    ).slice(0, 320);
    adjustments.push("enriched collectionSeoDescription");
  }

  const productRaw = Array.isArray(payload.products) ? payload.products : [];
  const products = productRaw
    .map((entry, index) => normalizeProduct(entry, index))
    .filter((p): p is ShopifyProduct => Boolean(p));

  if (products.length === 0) {
    payload.products = [
      normalizeProduct(
        {
          productName: "Hero-Produkt aus Design-Bericht",
          category: "Streetwear",
          description:
            "Produktlisting muss aus der Produktlinie des Design-Berichts abgeleitet werden.",
          shortDescription: "Hero-SKU aus Design-Intelligence.",
          materials: "Materialien aus Design-Bericht.",
          tags: ["drop", "limited", "streetwear"],
          seoTitle: "Hero-Produkt | Kollektion",
          seoDescription:
            "Shopify-Listing für Hero-Produkt basierend auf Design- und Marketing-Berichten.",
          suggestedPrice: "TBD",
          inventoryRecommendation:
            "Bestandsmenge aus Launch-Plan und CEO-Strategie ableiten.",
        },
        0,
      ),
    ].filter(Boolean);
    adjustments.push("generated placeholder products");
  } else {
    payload.products = products;
  }

  const bulletDefaults: Record<string, string[]> = {
    collectionsToCreate: [
      `Hauptkollektion "${collectionName}" mit allen Hero-SKUs aus Design-Bericht`,
    ],
    navigationRecommendations: [
      "Neue Kollektion als primärer Navigationspunkt im Hauptmenü",
      "Shop-All-Link mit Filter auf aktuelle Drop-Kategorie",
    ],
    homepageRecommendations: [
      `Hero-Banner mit Kollektionsstory "${collectionName}"`,
      "Featured Products: Top-3-SKUs aus Design-Hero-Produkten",
    ],
    launchChecklist: [
      "Produktentwürfe aus Design-Bericht als Shopify-Drafts anlegen",
      "SEO-Titel und -Beschreibungen aus Marketing-Plan übernehmen",
      "Kollektion erstellen und Produkte zuordnen",
      "Navigation und Homepage-Sektionen aktualisieren",
      "Preise und Bestände aus Pricing- und CEO-Berichten setzen",
      "Storefront-Preview prüfen vor Veröffentlichung",
    ],
    storefrontWarnings: [
      "Keine generischen Produkte — nur SKUs aus Design-Bericht verwenden",
      "Preise müssen mit Pricing-Intelligence übereinstimmen",
    ],
  };

  for (const [field, defaults] of Object.entries(bulletDefaults)) {
    const items = asStringArray(payload[field]);
    if (items.length < defaults.length) {
      payload[field] = [
        ...items,
        ...defaults.filter((d) => !items.includes(d)),
      ].slice(0, field === "launchChecklist" ? 16 : 10);
      adjustments.push(`enriched ${field}`);
    }
  }

  const sourceTitles = asStringArray(payload.sourceReportTitles);
  if (sourceTitles.length === 0) {
    payload.sourceReportTitles = ["Design-Bericht", "Marketing-Bericht"];
    adjustments.push("generated sourceReportTitles");
  }

  if (typeof payload.confidence !== "number" || Number.isNaN(payload.confidence)) {
    payload.confidence = 0.72;
    adjustments.push("set default confidence");
  } else {
    payload.confidence = Math.min(1, Math.max(0, payload.confidence));
  }

  const fullDraft = asString(payload.fullDraft);
  if (!fullDraft || fullDraft.length < MIN_FULL_DRAFT) {
    payload.fullDraft = buildFullDraft(payload);
    adjustments.push("enriched fullDraft");
  }

  return adjustments;
}
