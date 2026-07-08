import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { ProviderNormalizer } from "../normalization/interfaces";
import type { ProviderProvenance } from "../types/provider-source";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  entity,
  finalizeBundle,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("shopify");

function parsePrice(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeShopify(
  data: MilaeneCommerceBaseline,
  provenance: ProviderProvenance,
) {
  const { knowledge, productKnowledge, commerceIntelligence } = data;
  const brandName = data.businessMeta.primarySupplier || data.storeDomain;

  const signals = [
    ...knowledge.products.slice(0, 8).map((product) =>
      buildSignal({
        id: signalId(SOURCE, `product-${product.id}`),
        category: "commerce",
        label: product.title,
        headline: `${product.title} · ${product.currency}${product.price} · ${product.inventory} in stock`,
        value: product.price,
        direction: product.inventory > 0 ? "stable" : "declining",
        entities: [
          entity("product", product.title, product.id),
          entity("category", product.productType || "product"),
        ],
        tags: ["catalog", product.status, ...product.tags.slice(0, 3)],
        provenance,
        rawReference: product.id,
      }),
    ),
    ...commerceIntelligence.topUnits.slice(0, 5).map((unit, index) =>
      buildSignal({
        id: signalId(SOURCE, `top-unit-${index}`),
        category: "commerce",
        label: unit.title,
        headline: `Top seller · ${unit.title} · ${unit.unitsSold} units`,
        value: String(unit.unitsSold),
        direction: "up",
        entities: [entity("product", unit.title, unit.productId)],
        tags: ["bestseller", "owned_commerce"],
        provenance,
        observedAt: data.loadedAt,
        rawReference: unit.productId,
      }),
    ),
  ];

  const tagTerms = [
    ...new Set(knowledge.products.flatMap((p) => p.tags).slice(0, 40)),
  ];
  const trends = {
    rising: mentionClusters(
      tagTerms.map((term) => ({ term, count: 1 })),
      "keyword",
      provenance,
      SOURCE,
    ),
    stable: [],
    declining: [],
    emerging: mentionClusters(
      productKnowledge.categoryGaps.map((gap) => ({ term: gap, count: 1 })),
      "category",
      provenance,
      SOURCE,
    ),
    opportunities: productKnowledge.categoryGaps,
  };

  const summary = commerceIntelligence.summary;
  const market = {
    segments: knowledge.collections.slice(0, 10).map((collection, index) => ({
      id: signalId(SOURCE, `collection-${index}`),
      label: collection.title,
      channel: "owned_commerce" as const,
      categories: [collection.title],
      provenance,
    })),
    movements: [],
    priceBands: knowledge.priceRanges.map((range, index) => ({
      id: signalId(SOURCE, `price-${index}`),
      label: range.label,
      currency: range.currency,
      min: range.min,
      max: range.max,
      sweetSpot: Math.round((range.min + range.max) / 2),
      channel: "owned_commerce" as const,
      provenance,
    })),
    demandNarratives: [
      `${summary.totalUnits} units sold · ${summary.totalOrders} orders`,
      `${summary.productsWithSales} products with sales history`,
    ],
  };

  const commercial = {
    products: knowledge.products.slice(0, 20).map((product) => ({
      id: signalId(SOURCE, `commercial-${product.id}`),
      title: product.title,
      brand: brandName,
      category: product.productType || undefined,
      price: parsePrice(product.price),
      currency: product.currency,
      status: product.status,
      provenance,
    })),
    demandIndicators: [
      {
        id: signalId(SOURCE, "low-stock"),
        label: "Low stock SKUs",
        narrative: `${productKnowledge.inventoryState.lowStock} low-stock SKUs`,
        strength: "moderate" as const,
        provenance,
      },
      {
        id: signalId(SOURCE, "out-of-stock"),
        label: "Out of stock",
        narrative: `${productKnowledge.inventoryState.outOfStock} out-of-stock SKUs`,
        strength: "weak" as const,
        provenance,
      },
    ],
    opportunities: productKnowledge.categoryGaps.map((gap, index) => ({
      id: signalId(SOURCE, `gap-${index}`),
      title: gap,
      rationale: `Catalog gap detected · ${gap}`,
      tags: ["catalog-gap"],
      provenance,
    })),
    inventoryNarratives: [
      `${productKnowledge.inventoryState.activeProducts} active products`,
      `${productKnowledge.inventoryState.totalInventory} total inventory units`,
    ],
  };

  const brand = {
    mentions: brandName
      ? [
          {
            id: signalId(SOURCE, "brand-owned"),
            name: brandName,
            mentionCount: knowledge.products.length,
            signalType: "mention" as const,
            provenance,
          },
        ]
      : [],
    momentum: [],
    designers: [],
    culturalSignals: knowledge.products
      .flatMap((p) => p.tags)
      .slice(0, 8),
  };

  return finalizeBundle(provenance, signals, trends, market, commercial, brand);
}

export const shopifyNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<MilaeneCommerceBaseline>(envelope, normalizeShopify);
  },
};
