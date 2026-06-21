import type { AgentId } from "@/lib/constants/agents";
import {
  getAllSuppliers,
  isPrintOnDemand,
  type BusinessProfile,
} from "@/lib/business/business-profile";
import { formatAgentSupplierRules } from "@/lib/business/supplier-intelligence";
import { formatAgentMarketPrintRules } from "@/lib/marketprint/production-rules";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none configured)";
}

/** Format the global BUSINESS PROFILE block injected before Brain context. */
export function formatBusinessProfilePrompt(profile: BusinessProfile): string {
  const pod = isPrintOnDemand(profile);
  const suppliers = getAllSuppliers(profile);

  const lines = [
    "## BUSINESS PROFILE",
    "",
    `Brand:\n${profile.brand}`,
    "",
    `Industry:\n${profile.industry}`,
    "",
    `Business Model:\n${profile.businessModel}`,
    "",
    `Positioning:\n${profile.positioning}`,
    "",
    `Inventory:\n${profile.inventoryModel}`,
    "",
    `Warehouse:\n${profile.warehouse}`,
    "",
    `Fulfillment:\n${profile.fulfillment}`,
    "",
    `Primary Supplier:\n${profile.primarySupplier}`,
    "",
    `Secondary Suppliers:\n${joinList(profile.secondarySuppliers)}`,
    "",
    `Marketing Style:\n${profile.marketingStyle}`,
    "",
    `Product Strategy:\n${profile.productStrategy}`,
    "",
    `Platforms:\n${joinList(profile.platforms)}`,
    "",
    `Price Segment:\n${profile.priceSegment}`,
    "",
    `Target Audience:\n${profile.targetAudience}`,
    "",
    `Regions:\n${joinList(profile.regions)}`,
    "",
    `Sales Channels:\n${joinList(profile.salesChannels)}`,
    "",
    `Connected Apps:\n${joinList(profile.connectedApps)}`,
    "",
    "Rules:",
    "",
  ];

  if (pod) {
    lines.push(
      "- Do not assume physical inventory.",
      "- Do not suggest warehouse operations.",
      "- Do not suggest restocking.",
      "- Assume supplier fulfillment.",
      "- No fake scarcity or low-stock marketing.",
    );
  }

  lines.push(
    `- Respect ${profile.priceSegment.toLowerCase()} ${profile.industry.toLowerCase()} positioning.`,
    "- Respect current product ecosystem.",
    `- Production runs through ${profile.primarySupplier} first, then ${joinList(profile.secondarySuppliers)}.`,
  );

  return lines.join("\n");
}

/** Agent-specific business rules appended to system prompts. */
export function formatAgentBusinessRules(
  agentId: AgentId,
  profile: BusinessProfile,
): string {
  const pod = isPrintOnDemand(profile);
  const brand = profile.brand;
  const suppliers = getAllSuppliers(profile);
  const supplierRules = formatAgentSupplierRules(agentId, profile);
  const marketPrintRules = formatAgentMarketPrintRules(agentId);

  const baseRules = (() => {
    switch (agentId) {
      case "ceo":
        return [
          "## BUSINESS CONTEXT (CEO)",
          pod
            ? "- Milaene is Print On Demand — supplier ecosystem, not warehouse operations."
            : "- Operate within the configured business model.",
          `- Primary supplier: ${profile.primarySupplier}.`,
          "- Understand production limitations and supplier opportunities.",
          "- Never recommend warehouse, restocking, or physical inventory solutions.",
          `- Maintain ${profile.priceSegment.toLowerCase()} pricing discipline.`,
          `- Recommendations must fit ${profile.industry} and ${profile.targetAudience}.`,
        ];

      case "research":
        return [
          "## BUSINESS CONTEXT (Research)",
          `- Research for ${brand} as ${profile.positioning}.`,
          `- Audience: ${profile.targetAudience}. Regions: ${joinList(profile.regions)}.`,
          pod
            ? "- Do not recommend warehouse, wholesale inventory, or restock strategies."
            : "",
        ].filter(Boolean);

      case "designer":
        return [
          "## BUSINESS CONTEXT (Design)",
          `- Design only products that fit ${profile.industry.toLowerCase()} and ${profile.positioning}.`,
          `- Default to ${profile.primarySupplier} capabilities and POD production constraints.`,
          "- Embroidery, print areas, and materials must be supplier-realistic.",
          `- Secondary suppliers for new categories: ${joinList(profile.secondarySuppliers)}.`,
        ];

      case "image":
        return [
          "## BUSINESS CONTEXT (Image)",
          `- Generate campaigns matching ${profile.positioning}.`,
          "- Visual quality bar: premium fashion brands, realistic commercial photography.",
          `- Reflect ${profile.priceSegment} streetwear — editorial, not generic AI stock aesthetics.`,
          "- Respect POD print and embroidery limitations from supplier capabilities.",
        ];

      case "content":
        return [
          "## BUSINESS CONTEXT (Content)",
          `- Position ${brand} as a premium fashion brand — ${profile.positioning}.`,
          `- Voice: confident, minimal, ${profile.priceSegment.toLowerCase()} — never discount-market tone.`,
          `- Channels in scope: ${joinList(profile.salesChannels)}.`,
        ];

      case "marketing":
        return [
          "## BUSINESS CONTEXT (Marketing)",
          `- Position ${brand} as a premium fashion brand.`,
          `- Target: ${profile.targetAudience}. Channels: ${joinList(profile.salesChannels)}.`,
          pod
            ? "- Avoid fake scarcity, low-stock campaigns, and warehouse messaging."
            : "",
          "- Focus on storytelling, capsule drops, and premium positioning.",
        ].filter(Boolean);

      case "shopify":
        return [
          "## BUSINESS CONTEXT (Shopify)",
          `Primary Supplier: ${profile.primarySupplier}`,
          `Business Model: ${profile.businessModel}`,
          `Fulfillment: ${profile.fulfillment}`,
          pod
            ? "- Shopify tracks catalog availability — not warehouse stock."
            : "",
          "- Use SUPPLIER STATUS / SUPPLIER UNAVAILABLE / SUPPLIER CHECK terminology.",
          "- Do NOT recommend: restocking, warehouse operations, physical inventory management.",
        ].filter(Boolean);

      default:
        return [];
    }
  })();

  if (baseRules.length === 0) {
    return [supplierRules, marketPrintRules].filter(Boolean).join("\n\n");
  }

  return [baseRules.join("\n"), supplierRules, marketPrintRules]
    .filter(Boolean)
    .join("\n\n");
}
