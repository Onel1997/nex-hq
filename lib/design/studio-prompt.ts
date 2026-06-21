import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}

/** Format live Design Studio commerce context for the Design Agent system prompt. */
export function formatDesignStudioPrompt(
  studio: DesignStudioIntelligence,
): string {
  const productBaseLines = studio.productEcosystem
    .map(
      (row) =>
        `- ${row.category}: ${row.productCount} products · ${row.priceRange} · ${row.supplier}${row.activeCollections.length ? ` · Collections: ${joinList(row.activeCollections)}` : ""}`,
    )
    .join("\n");

  const existingProductLines = studio.existingProducts
    .slice(0, 10)
    .map(
      (p) =>
        `- ${p.title} (${p.category}) · ${p.price} ${p.currency} · MarketPrint ${p.marketPrintSuitability}% · premium ${p.premiumScore}/10`,
    )
    .join("\n");

  const collectionLines = studio.existingCollections
    .slice(0, 8)
    .map((c) => `- ${c.title} (${c.productCount} products)`)
    .join("\n");

  const opportunityLines = studio.productOpportunities
    .map(
      (o) =>
        `- ${o.title}: ${o.description}${o.marketPrintSuitability ? ` · MarketPrint ${o.marketPrintSuitability}%` : ""}`,
    )
    .join("\n");

  const capsuleLines = studio.capsuleIdeas
    .slice(0, 6)
    .map((c) => `- ${c.title}: ${c.description}`)
    .join("\n");

  return [
    "## DESIGN STUDIO — LIVE COMMERCE",
    "",
    "### Available Product Base",
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
    "### Existing Collections",
    collectionLines || "- (none)",
    "",
    "### Existing Milaene Products",
    existingProductLines || "- (none active)",
    "",
    "### Collection Opportunities",
    capsuleLines,
    "",
    "### Product Opportunities",
    opportunityLines,
    "",
    "### Product Gaps",
    studio.productGaps.map((g) => `- ${g}`).join("\n") || "- (none detected)",
    "",
    "### Available Materials",
    joinList(studio.availableMaterials),
    "",
    "### Price Context",
    studio.productEcosystem
      .filter((r) => r.priceRange !== "—")
      .map((r) => `- ${r.category}: ${r.priceRange}`)
      .join("\n") || "- (no live pricing)",
    "",
    "DESIGN AGENT RULES:",
    "- Act as Creative Director, Collection Developer, Fashion Designer — NOT a report writer",
    "- NEVER invent impossible materials, unavailable product types, or unsupported production methods",
    "- Every collection concept MUST reference existing Milaene products, suppliers, price ranges, categories",
    "- Create: new colorways, capsule collections, embroidery concepts, oversized silhouettes, premium variations",
    "- Each product in output MUST include marketPrintSuitability (0–100)",
    "- Use ONLY colors from Color Intelligence and materials from Available Materials",
    "- Default production partner: MarketPrint Print On Demand",
  ].join("\n");
}
