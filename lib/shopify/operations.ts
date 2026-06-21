import type {
  ProductKnowledge,
  ShopifyKnowledge,
  ShopifyKnowledgeProduct,
} from "@/lib/shopify/types";
import {
  isPrintOnDemand,
  MILAENE_BUSINESS_PROFILE,
  type BusinessProfile,
} from "@/lib/business/profile";

const LOW_STOCK_THRESHOLD = 5;

export interface ShopifyOperationsKpis {
  products: number;
  collections: number;
  categories: number;
  activeProducts: number;
  lowStock: number;
  averagePrice: number;
  averagePriceCurrency: string;
  highestPriceProduct: { title: string; price: number; currency: string } | null;
  bestSellerCandidate: { title: string; inventory: number } | null;
}

export type CommerceInsightKind =
  | "bestseller"
  | "pricing"
  | "inventory"
  | "supplier"
  | "category"
  | "expansion"
  | "ceo";

export interface CommerceInsight {
  id: string;
  kind: CommerceInsightKind;
  message: string;
  priority: "high" | "medium" | "low";
}

export interface CommerceActivityEvent {
  id: string;
  type:
    | "product_added"
    | "price_signal"
    | "collection"
    | "campaign"
    | "image"
    | "ceo"
    | "inventory";
  label: string;
  time: string;
  meta?: string;
}

export interface AgentConnectionStatus {
  design: boolean;
  image: boolean;
  marketing: boolean;
  content: boolean;
  ceo: boolean;
}

export interface ProductAgentInsights {
  design: string[];
  image: string[];
  marketing: string[];
  content: string[];
  ceo: string[];
  connections: AgentConnectionStatus;
}

export type ProductStockStatus = "active" | "low_stock" | "sold_out";

export function getProductStockStatus(product: ShopifyKnowledgeProduct): ProductStockStatus {
  if (product.status !== "ACTIVE") return "sold_out";
  if (product.inventory <= 0) return "sold_out";
  if (product.inventory <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "active";
}

export function buildOperationsKpis(
  knowledge: ShopifyKnowledge,
  productKnowledge: ProductKnowledge,
): ShopifyOperationsKpis {
  const prices = knowledge.products
    .map((p) => parseFloat(p.price))
    .filter((n) => !Number.isNaN(n));

  const currency = knowledge.products[0]?.currency ?? "EUR";
  const averagePrice =
    prices.length > 0
      ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
      : 0;

  let highest: ShopifyOperationsKpis["highestPriceProduct"] = null;
  for (const product of knowledge.products) {
    const price = parseFloat(product.price);
    if (Number.isNaN(price)) continue;
    if (!highest || price > highest.price) {
      highest = { title: product.title, price, currency: product.currency };
    }
  }

  const best = productKnowledge.bestsellerCandidates[0];

  return {
    products: knowledge.inventorySummary.totalProducts,
    collections: knowledge.collections.length,
    categories: knowledge.categories.length,
    activeProducts: knowledge.inventorySummary.activeProducts,
    lowStock: knowledge.inventorySummary.lowStock,
    averagePrice,
    averagePriceCurrency: currency,
    highestPriceProduct: highest,
    bestSellerCandidate: best
      ? { title: best.title, inventory: best.inventory }
      : null,
  };
}

export function buildCommerceInsights(
  knowledge: ShopifyKnowledge,
  productKnowledge: ProductKnowledge,
  businessProfile: BusinessProfile = MILAENE_BUSINESS_PROFILE,
): CommerceInsight[] {
  const insights: CommerceInsight[] = [];
  const pod = isPrintOnDemand(businessProfile);
  let id = 0;
  const nextId = () => `insight-${++id}`;

  for (const gap of productKnowledge.categoryGaps.slice(0, 4)) {
    insights.push({
      id: nextId(),
      kind: "category",
      message: `${gap} category missing from catalog.`,
      priority: "high",
    });
  }

  for (const candidate of productKnowledge.bestsellerCandidates.slice(0, 3)) {
    insights.push({
      id: nextId(),
      kind: "bestseller",
      message: pod
        ? `${candidate.title} — top catalog performer (POD-ready, ${candidate.inventory} virtual units).`
        : `${candidate.title} — strong inventory depth (${candidate.inventory} units).`,
      priority: "medium",
    });
  }

  const supplierFlagProducts = knowledge.products.filter(
    (p) => p.inventory > 0 && p.inventory <= LOW_STOCK_THRESHOLD,
  );
  for (const product of supplierFlagProducts.slice(0, 4)) {
    insights.push({
      id: nextId(),
      kind: pod ? "supplier" : "inventory",
      message: pod
        ? `Supplier flag: ${product.title} — verify POD availability with ${businessProfile.suppliers.join(", ") || "supplier"}.`
        : `Low stock: ${product.title} (${product.inventory} left).`,
      priority: "high",
    });
  }

  const unavailable = knowledge.products.filter(
    (p) => p.status === "ACTIVE" && p.inventory <= 0,
  );
  for (const product of unavailable.slice(0, 3)) {
    insights.push({
      id: nextId(),
      kind: pod ? "supplier" : "inventory",
      message: pod
        ? `POD unavailable: ${product.title} — check supplier catalog sync or disable listing.`
        : `Sold out: ${product.title} needs restock.`,
      priority: "high",
    });
  }

  const premiumBand = knowledge.priceRanges.find((r) => r.label === "Premium");
  if (premiumBand && premiumBand.productCount < 2 && knowledge.products.length >= 4) {
    insights.push({
      id: nextId(),
      kind: "pricing",
      message: "Premium pricing opportunity detected — expand top-tier assortment.",
      priority: "medium",
    });
  }

  const heavyweight = knowledge.products.filter((p) =>
    [...p.tags, ...p.materials, p.title].some((t) =>
      /heavyweight|gsm|450|500|600/i.test(t),
    ),
  );
  if (heavyweight.length >= 2) {
    insights.push({
      id: nextId(),
      kind: "expansion",
      message: "Heavyweight hoodies and fleece perform well — consider capsule expansion.",
      priority: "medium",
    });
  }

  const oversized = knowledge.tags.filter((t) => /oversized|boxy|relaxed/i.test(t));
  if (oversized.length > 0) {
    insights.push({
      id: nextId(),
      kind: "expansion",
      message: `Oversized fit trending across ${oversized.length} tag signals.`,
      priority: "low",
    });
  }

  if (knowledge.collections.length >= 2) {
    const topCollection = [...knowledge.collections].sort(
      (a, b) => b.productCount - a.productCount,
    )[0];
    if (topCollection) {
      insights.push({
        id: nextId(),
        kind: "ceo",
        message: `Lead with ${topCollection.title} collection (${topCollection.productCount} SKUs).`,
        priority: "medium",
      });
    }
  }

  if (knowledge.inventorySummary.outOfStock > knowledge.inventorySummary.inStock * 0.3) {
    insights.push({
      id: nextId(),
      kind: pod ? "supplier" : "ceo",
      message: pod
        ? "Catalog gap — review supplier POD mappings and enable missing product variants."
        : "Inventory imbalance — prioritize restock before new launches.",
      priority: "high",
    });
  }

  if (pod && businessProfile.suppliers.length > 0) {
    insights.push({
      id: nextId(),
      kind: "supplier",
      message: `Production via ${businessProfile.suppliers.join(", ")} — ${businessProfile.productionModel} fulfillment active.`,
      priority: "low",
    });
  }

  return insights.slice(0, 12);
}

export function buildActivityFeed(
  knowledge: ShopifyKnowledge,
  insights: CommerceInsight[],
): CommerceActivityEvent[] {
  const events: CommerceActivityEvent[] = [];
  const now = Date.now();

  for (const collection of knowledge.collections.slice(0, 4)) {
    events.push({
      id: `col-${collection.handle}`,
      type: "collection",
      label: `Collection live: ${collection.title}`,
      time: new Date(now - events.length * 3600000).toISOString(),
      meta: `${collection.productCount} products`,
    });
  }

  for (const product of knowledge.products
    .filter((p) => p.status === "ACTIVE")
    .slice(0, 5)) {
    events.push({
      id: `prod-${product.id}`,
      type: "product_added",
      label: product.title,
      time: new Date(now - (events.length + 2) * 7200000).toISOString(),
      meta: `${product.price} ${product.currency}`,
    });
  }

  for (const insight of insights.slice(0, 4)) {
    const typeMap: Record<CommerceInsightKind, CommerceActivityEvent["type"]> = {
      bestseller: "price_signal",
      pricing: "price_signal",
      inventory: "inventory",
      supplier: "inventory",
      category: "collection",
      expansion: "campaign",
      ceo: "ceo",
    };
    events.push({
      id: insight.id,
      type: typeMap[insight.kind],
      label: insight.message,
      time: new Date(now - (events.length + 5) * 1800000).toISOString(),
    });
  }

  return events.slice(0, 10);
}

export function buildGlobalAgentConnections(reportCounts: {
  design: number;
  image: number;
  marketing: number;
  content: number;
  ceo: number;
}): AgentConnectionStatus {
  return {
    design: reportCounts.design > 0,
    image: reportCounts.image > 0,
    marketing: reportCounts.marketing > 0,
    content: reportCounts.content > 0,
    ceo: reportCounts.ceo > 0,
  };
}

export function buildProductAgentInsights(
  product: ShopifyKnowledgeProduct,
  reportCounts: {
    design: number;
    image: number;
    marketing: number;
    content: number;
    ceo: number;
  },
  productKnowledge: ProductKnowledge,
  businessProfile: BusinessProfile = MILAENE_BUSINESS_PROFILE,
): ProductAgentInsights {
  const connections = buildGlobalAgentConnections(reportCounts);
  const pod = isPrintOnDemand(businessProfile);
  const titleLower = product.title.toLowerCase();
  const collectionHint = product.collections[0] ?? "the collection";

  const design: string[] = [];
  const image: string[] = [];
  const marketing: string[] = [];
  const content: string[] = [];
  const ceo: string[] = [];

  if (product.materials.length > 0) {
    design.push(
      `Style with ${product.materials.slice(0, 2).join(" and ")} — lean into fabric texture in lookbook shots.`,
    );
  }
  if (product.colors.length > 0) {
    design.push(
      `Color story: ${product.colors.slice(0, 3).join(", ")}. Pair with neutral tones for ${collectionHint}.`,
    );
  }
  if (product.tags.some((t) => /oversized|boxy/i.test(t))) {
    design.push("Oversized silhouette — show layered styling with wide-leg bottoms.");
  }

  if (product.imageUrl) {
    image.push("Featured image available — generate on-model and flat-lay mockups.");
  } else {
    image.push("No hero image — prioritize studio mockup generation.");
  }
  image.push(
    `Create ${product.productType.toLowerCase()} assets for IG feed, story, and PDP gallery.`,
  );

  if (product.collections.length > 0) {
    marketing.push(
      `Feature in ${product.collections.join(", ")} campaign carousel.`,
    );
  }
  if (getProductStockStatus(product) === "low_stock") {
    marketing.push(
      pod
        ? "Limited POD availability — urgency messaging without restock narrative."
        : "Urgency campaign: low inventory — limited drop messaging.",
    );
  } else if (getProductStockStatus(product) === "sold_out") {
    marketing.push(
      pod
        ? "Listing unavailable — recommend waitlist or supplier catalog re-sync."
        : "Waitlist / restock alert campaign recommended.",
    );
  } else {
    marketing.push("Include in weekly organic content rotation.");
  }

  content.push(
    `Product copy: ${product.title} — ${product.productType}, ${product.price} ${product.currency}.`,
  );
  if (product.tags.length > 0) {
    content.push(`Lead with tags: ${product.tags.slice(0, 4).join(", ")}.`);
  }

  const isBestseller = productKnowledge.bestsellerCandidates.some(
    (c) => c.id === product.id,
  );
  if (isBestseller) {
    ceo.push(
      pod
        ? "Bestseller candidate — prioritize visibility and POD supplier readiness."
        : "Bestseller candidate — protect inventory and prioritize visibility.",
    );
  }
  if (parseFloat(product.price) >= 80) {
    ceo.push("Premium price point — maintain scarcity and quality narrative.");
  }
  ceo.push(
    `${titleLower.includes("hoodie") ? "Core category performer" : "Assortment anchor"} for ${collectionHint}.`,
  );

  return { design, image, marketing, content, ceo, connections };
}

export function formatPrice(amount: string | number, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export function getStorefrontProductUrl(
  storeDomain: string,
  handle: string,
): string {
  const domain = storeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${domain}/products/${handle}`;
}

export function getShopifyAdminProductUrl(
  storeDomain: string,
  productGid: string,
): string {
  const domain = storeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const numericId = productGid.split("/").pop() ?? productGid;
  return `https://${domain}/admin/products/${numericId}`;
}
