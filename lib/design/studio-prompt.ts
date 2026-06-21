import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import {
  formatCommerceCurrency,
  formatHistoricalPlaceholder,
  HISTORICAL_READ_ALL_ORDERS_WARNING,
  isCommerceHistoryActive,
} from "@/lib/shopify/commerce-shared";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function formatPerformanceProductLine(
  p: DesignStudioIntelligence["designIntelligence"]["scoredProducts"][number],
): string {
  const historical = p.historical;
  if (historical && historical.unitsSold > 0) {
    return `- ${p.title}: ${historical.unitsSold} units · historical score ${historical.historicalScore} · rank #${historical.bestsellerRank} · hero ${p.heroProductScore}% · first sale ${historical.firstSale ?? "—"} · last sale ${historical.lastSale ?? "—"}`;
  }
  const commerce = p.commerce;
  if (commerce && commerce.unitsSold > 0) {
    return `- ${p.title}: ${commerce.unitsSold} units · ${formatCommerceCurrency(commerce.revenue, commerce.currency)} · rank #${commerce.unitsRank} · hero ${p.heroProductScore}% · first sale ${commerce.firstSaleDate ?? "—"} · last sale ${commerce.lastSaleDate ?? "—"}`;
  }
  const perf = p.performance;
  if (!perf) {
    return `- ${p.title}: hero ${p.heroProductScore}% · catalog + supplier scored`;
  }
  return `- ${p.title}: ${formatCommerceCurrency(perf.revenue, perf.currency)} · ${perf.unitsSold} units · rank #${perf.salesRank} · hero ${p.heroProductScore}%`;
}

/** Format live Design Studio commerce context for the Design Agent system prompt. */
export function formatDesignStudioPrompt(
  studio: DesignStudioIntelligence,
): string {
  const commerce = studio.commerceIntelligence;
  const historicalImport = commerce?.import;
  const historyActive =
    isCommerceHistoryActive(commerce?.historical) ||
    Boolean(historicalImport?.summary.totalOrders);
  const placeholders = commerce?.historical?.placeholders;

  const productBaseLines = studio.productEcosystem
    .map(
      (row) =>
        `- ${row.category}: ${row.productCount} products · ${row.priceRange} · ${row.supplier}${row.activeCollections.length ? ` · Collections: ${joinList(row.activeCollections)}` : ""}`,
    )
    .join("\n");

  const commerceSummary = historyActive && commerce
    ? [
        historicalImport
          ? `Source: Shopify export (${historicalImport.summary.sourcePath ?? "csv-import"})`
          : null,
        `All-time revenue: ${formatCommerceCurrency(commerce.summary.totalRevenue, commerce.summary.currency)}`,
        `Units sold: ${commerce.summary.totalUnits}`,
        `Orders: ${commerce.summary.totalOrders}`,
        `Average order value: ${formatCommerceCurrency(commerce.summary.averageOrderValue, commerce.summary.currency)}`,
        `Products with sales: ${commerce.summary.productsWithSales}`,
        `Historical-only SKUs: ${commerce.summary.historicalProductCount}`,
        `Repeat-purchase SKUs: ${commerce.summary.repeatPurchaseProductCount}`,
        `First order: ${commerce.summary.firstOrderDate ?? historicalImport?.summary.firstSaleDate ?? "—"}`,
        `Last order: ${commerce.summary.lastOrderDate ?? historicalImport?.summary.lastSaleDate ?? "—"}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : [
        "Historical commerce: unavailable",
        placeholders
          ? `Historical revenue: ${formatHistoricalPlaceholder(placeholders.historicalRevenue, commerce?.summary.currency)}`
          : "Historical revenue: unavailable",
        placeholders
          ? `Historical units: ${formatHistoricalPlaceholder(placeholders.historicalUnits)}`
          : "Historical units: unavailable",
        placeholders
          ? `Historical bestseller: ${placeholders.historicalBestseller}`
          : "Historical bestseller: unavailable",
        commerce?.historical?.warning ?? HISTORICAL_READ_ALL_ORDERS_WARNING,
      ].join(" · ");

  const categoryLines =
    historyActive && commerce
      ? commerce.topCategories
          .slice(0, 8)
          .map(
            (c) =>
              `- ${c.category}: ${c.unitsSold} units · ${formatCommerceCurrency(c.revenue, commerce.summary.currency)} · ${c.productCount} SKUs`,
          )
          .join("\n")
      : studio.productEcosystem
          .filter((row) => row.productCount > 0)
          .map(
            (row) =>
              `- ${row.category}: ${row.productCount} catalog products · ${row.priceRange} · historical sales unavailable`,
          )
          .join("\n") || "- (use live catalog categories — historical sales unavailable)";

  const collectionLinesCommerce =
    historyActive && commerce
      ? commerce.topCollections
          .slice(0, 8)
          .map(
            (c) =>
              `- ${c.title}: ${c.unitsSold} units · ${formatCommerceCurrency(c.revenue, commerce.summary.currency)}`,
          )
          .join("\n")
      : studio.existingCollections
          .slice(0, 8)
          .map((c) => `- ${c.title}: ${c.productCount} products · sales history unavailable`)
          .join("\n") || "- (use existing collections — historical sales unavailable)";

  const seasonalityLines =
    historyActive && commerce
      ? commerce.seasonality
          .slice(0, 6)
          .map(
            (s) =>
              `- ${s.monthLabel}: ${s.unitsSold} units · ${formatCommerceCurrency(s.revenue, commerce.summary.currency)} · ${s.orderCount} orders`,
          )
          .join("\n")
      : "- (seasonality unavailable until historical orders are connected)";

  const topUnitsLines =
    historyActive && historicalImport
      ? historicalImport.topProducts
          .slice(0, 10)
          .map((p) => `- ${p.title}: ${p.unitsSold} units · historical score ${p.historicalScore}`)
          .join("\n")
      : historyActive && commerce
        ? commerce.topUnits.slice(0, 10).map((p) => `- ${p.title}: ${p.unitsSold} units`).join("\n")
        : studio.designIntelligence.topSellers
            .slice(0, 10)
            .map(formatPerformanceProductLine)
            .join("\n");

  const topRevenueLines =
    historyActive && commerce
      ? commerce.topRevenue
          .slice(0, 8)
          .map(
            (p) =>
              `- ${p.title}: ${formatCommerceCurrency(p.revenue, p.currency)} · ${p.unitsSold} units`,
          )
          .join("\n")
      : studio.designIntelligence.mostRevenue
          .slice(0, 8)
          .map(formatPerformanceProductLine)
          .join("\n") || "- (historical revenue unavailable)";

  const heroLines =
    historyActive && commerce
      ? commerce.heroProducts
          .slice(0, 10)
          .map(
            (p) =>
              `- ${p.title}: commerce ${p.commerceScore}% · ${p.unitsSold} units · hero-weighted priority`,
          )
          .join("\n")
      : studio.designIntelligence.topHeroProducts
          .slice(0, 8)
          .map((p) => `- ${p.title}: hero ${p.heroProductScore}% · catalog + supplier scored`)
          .join("\n");

  const repeatLines =
    historyActive && commerce
      ? commerce.repeatPurchaseProducts
          .slice(0, 8)
          .map((p) => `- ${p.title}: ${p.orderCount} orders · ${p.unitsSold} units`)
          .join("\n")
      : "- (repeat purchase data unavailable without historical orders)";

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
    historyActive && commerce?.mostSoldCategory && commerce.topCategories.length > 1
      ? `Lead with ${commerce.mostSoldCategory.category} (${commerce.mostSoldCategory.unitsSold} units) before lower-volume categories like ${commerce.topCategories[commerce.topCategories.length - 1]?.category ?? "others"}.`
      : "Historical sales unavailable — prioritize live catalog structure, supplier capabilities, and design scores until read_all_orders or an import provider is connected.";

  const commerceSectionTitle = historyActive
    ? "### Commerce Intelligence (ALL-TIME SHOPIFY HISTORY — HIGHEST PRIORITY)"
    : "### Commerce Intelligence (CATALOG MODE — historical sales unavailable)";

  const priorityRule = historyActive
    ? "PRIORITY RULE: Historical Shopify performance ALWAYS overrides current catalog structure."
    : "PRIORITY RULE: Work from live products, collections, and supplier capabilities. Do NOT invent historical bestsellers. When historical data becomes available, commerce signals take priority automatically.";

  const agentRules = historyActive
    ? [
        "- COMMERCE FIRST: recommend categories and SKUs with the highest all-time unit sales before catalog gaps or new concepts",
        "- Example: if T-Shirts sold 280 units and Hoodies sold 60 units, anchor the collection on T-Shirts first",
        "- Use complete Shopify order history — include historical SKUs even if inactive in catalog",
        "- Hero Product Score = 40% all-time sales + 20% design fit + 20% supplier fit + 20% campaign potential",
        "- Prioritize topUnits, topRevenue, heroProducts, and repeatPurchaseProducts before inventing new capsule anchors",
      ]
    : [
        "- CATALOG MODE: historical revenue/units/bestsellers are unavailable — do not claim sales rankings you cannot see",
        "- Anchor on product ecosystem counts, existing collections, MarketPrint supplier fit, and hero scores",
        "- Hero Product Score = design fit + supplier fit + campaign potential (no commerce weight until history connects)",
        "- When read_all_orders or a commerce import provider is enabled, switch to commerce-first recommendations automatically",
      ];

  return [
    "## DESIGN STUDIO — LIVE COMMERCE",
    "",
    commerceSectionTitle,
    commerceSummary,
    "",
    priorityRule,
    catalogVsHistory,
    "",
    historyActive ? "### Category Sales (all-time)" : "### Product Ecosystem (catalog — use while history unavailable)",
    categoryLines,
    "",
    historyActive ? "### Strongest Collections (all-time)" : "### Existing Collections (catalog)",
    collectionLinesCommerce,
    "",
    "### Seasonality",
    seasonalityLines,
    "",
    historyActive ? "### Top Units Sold" : "### Top Catalog Candidates (no historical units)",
    topUnitsLines || "- (no sales data)",
    "",
    historyActive ? "### Top Revenue Products" : "### Revenue Leaders (catalog-scored fallback)",
    topRevenueLines,
    "",
    historyActive ? "### Hero Products (commerce-weighted)" : "### Hero Products (catalog + supplier)",
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
    `Commerce history active: ${historyActive ? "yes" : "no"}`,
    "",
    "### Current Catalog Product Base (always available)",
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
    "### Full Product Scorecard (design + supplier" +
      (historyActive ? " + history" : "") +
      ")",
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
    ...agentRules,
    "- Do NOT anchor collections on lowest performing or zero-sale products",
    "- Each output product MUST include marketPrintSuitability (0–100)",
    "- Default production partner: MarketPrint Print On Demand",
  ].join("\n");
}
