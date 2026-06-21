import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import { formatCommerceCurrency } from "@/lib/shopify/commerce-intelligence";
import { formatPerformanceCurrency } from "@/lib/shopify/performance";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function formatPerformanceProductLine(
  p: DesignStudioIntelligence["designIntelligence"]["scoredProducts"][number],
): string {
  const commerce = p.commerce;
  if (commerce) {
    return `- ${p.title}: ${commerce.unitsSold} units · ${formatCommerceCurrency(commerce.revenue, commerce.currency)} · rank #${commerce.unitsRank} · hero ${p.heroProductScore}% · first sale ${commerce.firstSaleDate ?? "—"} · last sale ${commerce.lastSaleDate ?? "—"}`;
  }
  const perf = p.performance;
  if (!perf) {
    return `- ${p.title}: hero ${p.heroProductScore}% · no Shopify sales in history`;
  }
  return `- ${p.title}: ${formatPerformanceCurrency(perf.revenue, perf.currency)} · ${perf.unitsSold} units · rank #${perf.salesRank} · hero ${p.heroProductScore}%`;
}

/** Format live Design Studio commerce context for the Design Agent system prompt. */
export function formatDesignStudioPrompt(
  studio: DesignStudioIntelligence,
): string {
  const commerce = studio.commerceIntelligence;
  const productBaseLines = studio.productEcosystem
    .map(
      (row) =>
        `- ${row.category}: ${row.productCount} products · ${row.priceRange} · ${row.supplier}${row.activeCollections.length ? ` · Collections: ${joinList(row.activeCollections)}` : ""}`,
    )
    .join("\n");

  const commerceSummary = commerce
    ? [
        `All-time revenue: ${formatCommerceCurrency(commerce.summary.totalRevenue, commerce.summary.currency)}`,
        `Units sold: ${commerce.summary.totalUnits}`,
        `Orders: ${commerce.summary.totalOrders}`,
        `Average order value: ${formatCommerceCurrency(commerce.summary.averageOrderValue, commerce.summary.currency)}`,
        `Products with sales: ${commerce.summary.productsWithSales}`,
        `Historical-only SKUs: ${commerce.summary.historicalProductCount}`,
        `Repeat-purchase SKUs: ${commerce.summary.repeatPurchaseProductCount}`,
        `First order: ${commerce.summary.firstOrderDate ?? "—"}`,
        `Last order: ${commerce.summary.lastOrderDate ?? "—"}`,
      ].join(" · ")
    : "Shopify order history unavailable";

  const categoryLines = commerce
    ? commerce.topCategories
        .slice(0, 8)
        .map(
          (c) =>
            `- ${c.category}: ${c.unitsSold} units · ${formatCommerceCurrency(c.revenue, commerce.summary.currency)} · ${c.productCount} SKUs`,
        )
        .join("\n")
    : "- (no category sales data)";

  const collectionLinesCommerce = commerce
    ? commerce.topCollections
        .slice(0, 8)
        .map(
          (c) =>
            `- ${c.title}: ${c.unitsSold} units · ${formatCommerceCurrency(c.revenue, commerce.summary.currency)}`,
        )
        .join("\n")
    : "- (no collection sales data)";

  const seasonalityLines = commerce
    ? commerce.seasonality
        .slice(0, 6)
        .map(
          (s) =>
            `- ${s.monthLabel}: ${s.unitsSold} units · ${formatCommerceCurrency(s.revenue, commerce.summary.currency)} · ${s.orderCount} orders`,
        )
        .join("\n")
    : "- (no seasonality data)";

  const topUnitsLines = commerce
    ? commerce.topUnits.slice(0, 10).map((p) => `- ${p.title}: ${p.unitsSold} units`).join("\n")
    : studio.designIntelligence.topSellers.slice(0, 10).map(formatPerformanceProductLine).join("\n");

  const topRevenueLines = commerce
    ? commerce.topRevenue
        .slice(0, 8)
        .map(
          (p) =>
            `- ${p.title}: ${formatCommerceCurrency(p.revenue, p.currency)} · ${p.unitsSold} units`,
        )
        .join("\n")
    : "- (no revenue data)";

  const heroLines = commerce
    ? commerce.heroProducts
        .slice(0, 10)
        .map(
          (p) =>
            `- ${p.title}: commerce ${p.commerceScore}% · ${p.unitsSold} units · hero-weighted priority`,
        )
        .join("\n")
    : studio.designIntelligence.topHeroProducts
        .slice(0, 8)
        .map((p) => `- ${p.title}: hero ${p.heroProductScore}%`)
        .join("\n");

  const repeatLines = commerce
    ? commerce.repeatPurchaseProducts
        .slice(0, 8)
        .map((p) => `- ${p.title}: ${p.orderCount} orders · ${p.unitsSold} units`)
        .join("\n")
    : "- (none detected)";

  const existingProductLines = studio.designIntelligence.scoredProducts
    .slice(0, 15)
    .map(formatPerformanceProductLine)
    .join("\n");

  const collectionLines = studio.existingCollections
    .slice(0, 8)
    .map((c) => `- ${c.title} (${c.productCount} products)`)
    .join("\n");

  const opportunityLines = studio.scoredOpportunities
    .slice(0, 6)
    .map((o) => `- ${o.title}: ${o.description} · confidence ${o.confidence}%`)
    .join("\n");

  const lowScoreProducts = studio.designIntelligence.scoredProducts
    .filter((p) => p.heroProductScore < 55)
    .slice(0, 6)
    .map((p) => `- ${p.title} (${p.heroProductScore}%)`)
    .join("\n");

  const catalogVsHistory =
    commerce?.mostSoldCategory && commerce.topCategories.length > 1
      ? `Lead with ${commerce.mostSoldCategory.category} (${commerce.mostSoldCategory.unitsSold} units) before lower-volume categories like ${commerce.topCategories[commerce.topCategories.length - 1]?.category ?? "others"}.`
      : "Prioritize categories with verified unit sales over catalog structure.";

  return [
    "## DESIGN STUDIO — LIVE COMMERCE",
    "",
    "### Commerce Intelligence (ALL-TIME SHOPIFY HISTORY — HIGHEST PRIORITY)",
    commerceSummary,
    "",
    "PRIORITY RULE: Historical Shopify performance ALWAYS overrides current catalog structure.",
    catalogVsHistory,
    "",
    "### Category Sales (all-time)",
    categoryLines,
    "",
    "### Strongest Collections (all-time)",
    collectionLinesCommerce,
    "",
    "### Seasonality",
    seasonalityLines,
    "",
    "### Top Units Sold",
    topUnitsLines || "- (no sales data)",
    "",
    "### Top Revenue Products",
    topRevenueLines,
    "",
    "### Hero Products (commerce-weighted)",
    heroLines || "- (none above threshold)",
    "",
    "### Repeat Purchase Products",
    repeatLines,
    "",
    "### Design Intelligence Summary",
    `Products analyzed: ${studio.designIntelligence.scoredProducts.length}`,
    `Average hero score: ${studio.summary.averageCompositeScore}%`,
    `Hero products: ${studio.summary.heroProductCount}`,
    `Average MarketPrint fit: ${studio.summary.averageSuitability}%`,
    "",
    "### Current Catalog Product Base (secondary to sales history)",
    productBaseLines,
    "",
    "### Supplier Capabilities",
    `Primary: ${studio.supplierCapabilities.primarySupplier}`,
    "Capabilities:",
    ...studio.supplierCapabilities.capabilities.map((c) => `- ${c}`),
    "Limitations:",
    ...studio.supplierCapabilities.limitations.map((l) => `- ${l}`),
    "",
    "### Color Intelligence",
    `Supplier colors (prioritize): ${joinList(studio.colorIntelligence.supplierColors)}`,
    `Catalog colors: ${joinList(studio.colorIntelligence.catalogColors) || "(none detected)"}`,
    "",
    "### Existing Collections (catalog)",
    collectionLines || "- (none)",
    "",
    "### Full Product Scorecard (history + design + supplier)",
    existingProductLines || "- (none)",
    "",
    "### Collection Opportunities (performance-weighted)",
    opportunityLines,
    "",
    "### Product Gaps",
    studio.productGaps.map((g) => `- ${g}`).join("\n") || "- (none detected)",
    "",
    "### Available Materials",
    joinList(studio.availableMaterials),
    "",
    "### Low-Priority Products (avoid as anchors)",
    lowScoreProducts || "- (none flagged)",
    "",
    "DESIGN AGENT RULES:",
    "- Act as Fashion Buyer, Creative Director, and Product Strategist — NOT a generic AI assistant or report generator",
    "- COMMERCE FIRST: recommend categories and SKUs with the highest all-time unit sales before catalog gaps or new concepts",
    "- Example: if T-Shirts sold 280 units and Hoodies sold 60 units, anchor the collection on T-Shirts first",
    "- Use complete Shopify order history — include historical SKUs even if inactive in catalog",
    "- Hero Product Score = 40% all-time sales + 20% design fit + 20% supplier fit + 20% campaign potential",
    "- Prioritize topUnits, topRevenue, heroProducts, and repeatPurchaseProducts before inventing new capsule anchors",
    "- Do NOT anchor collections on lowest performing or zero-sale products",
    "- Each output product MUST include marketPrintSuitability (0–100)",
    "- Default production partner: MarketPrint Print On Demand",
  ].join("\n");
}
