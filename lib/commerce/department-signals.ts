import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { MILAENE_PROFILE } from "@/lib/business/business-profile";
import { buildDesignIntelligenceDashboard } from "@/lib/design/product-intelligence";
import type { CommerceInsight } from "@/lib/shopify/operations";
import { formatPrice } from "@/lib/shopify/operations";

function insightLines(insights: CommerceInsight[], kinds?: CommerceInsight["kind"][]): string[] {
  const filtered = kinds
    ? insights.filter((i) => kinds.includes(i.kind))
    : insights;
  return filtered.map((i) => `- [${i.priority}] ${i.message}`);
}

/** Commerce signals for CEO Command — bestsellers, collections, supplier checks. */
export function formatCeoCommerceSignals(baseline: MilaeneCommerceBaseline): string {
  const { insights, commerceIntelligence, businessMeta, kpis } = baseline;
  const lines = [
    "MILAENE COMMERCE INTELLIGENCE (Shopify Operations baseline)",
    `Supplier: ${businessMeta.primarySupplier} · ${businessMeta.businessModel} · ${businessMeta.fulfillment}`,
    `Catalog: ${kpis.products} products · ${kpis.collections} collections · ${kpis.activeProducts} active`,
    "",
    "Commerce signals:",
    ...insightLines(insights, ["bestseller", "ceo", "supplier", "category"]),
  ];

  const bestseller = commerceIntelligence.allTimeBestseller;
  if (bestseller) {
    lines.push(
      "",
      `All-time bestseller: ${bestseller.title} — ${bestseller.unitsSold} units · ${formatPrice(bestseller.revenue, bestseller.currency)}`,
    );
  }

  const restock = insights.filter((i) =>
    /restock|supplier status|supplier unavailable|supplier check/i.test(i.message),
  );
  if (restock.length > 0) {
    lines.push("", "Restock / supplier warnings:", ...insightLines(restock));
  }

  return lines.join("\n");
}

/** Product intelligence for Design Studio — categories, materials, MarketPrint fit. */
export function formatDesignCommerceSignals(baseline: MilaeneCommerceBaseline): string {
  const { insights, marketPrintIntelligence, productKnowledge } = baseline;
  const lines = [
    "PRODUCT INTELLIGENCE (from Shopify Operations)",
    "",
    "Category gaps:",
    ...productKnowledge.categoryGaps.map((g) => `- ${g}`),
    "",
    "Bestseller candidates:",
    ...productKnowledge.bestsellerCandidates
      .slice(0, 5)
      .map((p) => `- ${p.title} (${p.inventory} virtual units)`),
    "",
    "MarketPrint premium:",
    ...marketPrintIntelligence.premiumProducts
      .slice(0, 4)
      .map((p) => `- ${p.title}: ${p.match.suitability}% fit`),
    "",
    "Design-relevant signals:",
    ...insightLines(insights, ["category", "expansion", "marketprint"]),
  ];

  return lines.join("\n");
}

/** Campaign products and launch timing for Marketing Center. */
export function formatMarketingCommerceSignals(baseline: MilaeneCommerceBaseline): string {
  const { insights, marketPrintIntelligence, commerceIntelligence } = baseline;
  const lines = [
    "CAMPAIGN INTELLIGENCE (from Shopify Operations)",
    "",
    "Campaign-ready products:",
    ...marketPrintIntelligence.campaignProducts
      .slice(0, 6)
      .map(
        (p) =>
          `- ${p.title}: streetwear ${p.match.capability.streetwearScore}/10 · ${p.match.suitability}% MarketPrint fit`,
      ),
    "",
    "Top revenue products:",
    ...commerceIntelligence.topRevenue
      .slice(0, 5)
      .map(
        (p) =>
          `- ${p.title}: ${formatPrice(p.revenue, p.currency)} · ${p.unitsSold} units`,
      ),
    "",
    "Campaign recommendations:",
    ...insightLines(insights, ["bestseller", "expansion", "marketprint", "ceo"]),
  ];

  return lines.join("\n");
}

/** Production information for Image Studio — materials, embroidery, hero assets. */
export function formatImageCommerceSignals(baseline: MilaeneCommerceBaseline): string {
  const { insights, marketPrintIntelligence, knowledge } = baseline;
  const missingImages = knowledge.products.filter((p) => !p.imageUrl && p.status === "ACTIVE");

  const lines = [
    "PRODUCTION INTELLIGENCE (from Shopify Operations)",
    "",
    "Embroidery products:",
    ...marketPrintIntelligence.embroideryProducts
      .slice(0, 5)
      .map((p) => `- ${p.title}: ${p.match.capability.material}`),
    "",
    "Premium production targets:",
    ...marketPrintIntelligence.premiumProducts
      .slice(0, 5)
      .map((p) => `- ${p.title}: premium ${p.match.capability.premiumScore}/10`),
  ];

  if (missingImages.length > 0) {
    lines.push(
      "",
      "Missing hero images (priority mockups):",
      ...missingImages.slice(0, 6).map((p) => `- ${p.title} (${p.productType})`),
    );
  }

  lines.push("", "Production signals:", ...insightLines(insights, ["marketprint", "supplier"]));

  return lines.join("\n");
}

/** Sales and inventory signals for Commerce Lab. */
export function formatCommerceLabSignals(baseline: MilaeneCommerceBaseline): string {
  const { commerceIntelligence, insights, activity } = baseline;
  const summary = commerceIntelligence.summary;

  const lines = [
    "SALES & INVENTORY SIGNALS (Shopify Operations baseline)",
    `Revenue: ${formatPrice(summary.totalRevenue, summary.currency)} · ${summary.totalUnits} units · ${summary.totalOrders} orders`,
    `AOV: ${formatPrice(summary.averageOrderValue, summary.currency)}`,
    "",
    "Bestseller analysis:",
    ...commerceIntelligence.topUnits
      .slice(0, 6)
      .map(
        (p) =>
          `- #${p.unitsRank} ${p.title}: ${p.unitsSold} units · score ${p.commerceScore}`,
      ),
    "",
    "Restock / supplier warnings:",
    ...insightLines(insights, ["supplier", "inventory"]),
    "",
    "Recent activity:",
    ...activity.slice(0, 5).map((e) => `- ${e.label}`),
  ];

  return lines.join("\n");
}

/** Sales, catalog, POD and trend signals for Research Agent context. */
export function formatResearchCommerceSignals(
  baseline: MilaeneCommerceBaseline,
): string {
  const {
    insights,
    commerceIntelligence,
    productKnowledge,
    marketPrintIntelligence,
    businessMeta,
    kpis,
  } = baseline;

  const designIntel = buildDesignIntelligenceDashboard(
    baseline.knowledge.products,
    undefined,
    commerceIntelligence,
  );

  const lines = [
    "RESEARCH INTELLIGENCE (Milaene Commerce + POD baseline)",
    `Brand context: Premium minimalist streetwear · POD via ${businessMeta.primarySupplier}`,
    `Catalog: ${kpis.products} products · ${kpis.activeProducts} active · ${kpis.collections} collections`,
    "",
    "Bestsellers:",
    ...commerceIntelligence.topUnits
      .slice(0, 6)
      .map((p) => `- ${p.title}: ${p.unitsSold} units · score ${p.commerceScore}`),
    "",
    "Weak / low-priority products:",
    ...designIntel.lowestPerforming
      .slice(0, 4)
      .map((p) => `- ${p.title} (${p.badges.join(", ") || "review"})`),
    "",
    "Category gaps:",
    ...productKnowledge.categoryGaps.map((g) => `- ${g}`),
    "",
    "MarketPrint POD:",
    `Matched: ${marketPrintIntelligence.summary.matchedProducts} · Premium: ${marketPrintIntelligence.summary.premiumCount} · Embroidery: ${marketPrintIntelligence.summary.embroideryCount}`,
    ...marketPrintIntelligence.premiumProducts
      .slice(0, 4)
      .map((p) => `- ${p.title}: ${p.match.suitability}% fit`),
    "",
    "Secondary suppliers:",
    ...MILAENE_PROFILE.secondarySuppliers.map((s) => `- ${s}`),
    "",
    "Commerce signals for research:",
    ...insightLines(insights, [
      "bestseller",
      "category",
      "expansion",
      "marketprint",
      "supplier",
    ]),
  ];

  return lines.join("\n");
}

export function formatDepartmentCommerceSignals(
  department: "ceo" | "design" | "marketing" | "image" | "commerce-lab" | "research",
  baseline: MilaeneCommerceBaseline,
): string {
  switch (department) {
    case "ceo":
      return formatCeoCommerceSignals(baseline);
    case "design":
      return formatDesignCommerceSignals(baseline);
    case "marketing":
      return formatMarketingCommerceSignals(baseline);
    case "image":
      return formatImageCommerceSignals(baseline);
    case "commerce-lab":
      return formatCommerceLabSignals(baseline);
    case "research":
      return formatResearchCommerceSignals(baseline);
  }
}
