import type { AgentId } from "@/lib/constants/agents";
import {
  isPrintOnDemand,
  type BusinessProfile,
} from "@/lib/business/profile";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none configured)";
}

/** Format the global BUSINESS PROFILE block injected before Brain context. */
export function formatBusinessProfilePrompt(profile: BusinessProfile): string {
  const pod = isPrintOnDemand(profile);

  const lines = [
    "## BUSINESS PROFILE",
    "",
    `Brand:\n${profile.brandName}`,
    "",
    `Industry:\n${profile.industry}`,
    "",
    `Business Model:\n${profile.businessModel}`,
    "",
    `Positioning:\n${profile.positioning}`,
    "",
    `Production:\n${profile.productionModel}`,
    "",
    `Inventory:\n${profile.inventoryModel}`,
    "",
    `Fulfillment:\n${profile.fulfillmentModel}`,
    "",
    `Suppliers:\n${joinList(profile.suppliers)}`,
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
    "Rules:",
    "",
  ];

  if (pod) {
    lines.push(
      "- Do not assume physical inventory.",
      "- Do not suggest warehouse operations.",
      "- Do not suggest restocking.",
      "- Assume supplier fulfillment.",
    );
  }

  lines.push(
    `- Respect ${profile.priceSegment.toLowerCase()} ${profile.industry.toLowerCase()} positioning.`,
    "- Respect current product ecosystem.",
    `- Production runs through configured suppliers (${joinList(profile.suppliers)}).`,
  );

  return lines.join("\n");
}

/** Agent-specific business rules appended to system prompts. */
export function formatAgentBusinessRules(
  agentId: AgentId,
  profile: BusinessProfile,
): string {
  const pod = isPrintOnDemand(profile);
  const brand = profile.brandName;

  switch (agentId) {
    case "ceo":
      return [
        "## BUSINESS CONTEXT (CEO)",
        pod
          ? "- This is a Print-on-Demand business — no warehouse, no physical stock operations."
          : "- Operate within the configured business model.",
        "- Supplier handles production and fulfillment.",
        `- Maintain ${profile.priceSegment.toLowerCase()} pricing discipline.`,
        `- Recommendations must fit ${profile.industry} and ${profile.targetAudience}.`,
      ].join("\n");

    case "research":
      return [
        "## BUSINESS CONTEXT (Research)",
        `- Research for ${brand} as ${profile.positioning}.`,
        `- Audience: ${profile.targetAudience}. Regions: ${joinList(profile.regions)}.`,
        pod
          ? "- Do not recommend warehouse, wholesale inventory, or restock strategies."
          : "",
      ]
        .filter(Boolean)
        .join("\n");

    case "designer":
      return [
        "## BUSINESS CONTEXT (Design)",
        `- Design only products that fit ${profile.industry.toLowerCase()} and ${profile.positioning}.`,
        "- Use existing catalog categories and supplier-realistic POD production constraints.",
        `- Suppliers: ${joinList(profile.suppliers)} — designs must be producible on demand.`,
        "- Do not propose products outside the current ecosystem without explicit catalog gap justification.",
      ].join("\n");

    case "image":
      return [
        "## BUSINESS CONTEXT (Image)",
        `- Generate campaigns matching ${profile.positioning}.`,
        "- Visual quality bar: premium fashion brands, realistic commercial photography.",
        `- Reflect ${profile.priceSegment} streetwear — editorial, not generic AI stock aesthetics.`,
      ].join("\n");

    case "content":
      return [
        "## BUSINESS CONTEXT (Content)",
        `- Position ${brand} as a premium fashion brand — ${profile.positioning}.`,
        `- Voice: confident, minimal, ${profile.priceSegment.toLowerCase()} — never discount-market tone.`,
        `- Channels in scope: ${joinList(profile.salesChannels)}.`,
      ].join("\n");

    case "marketing":
      return [
        "## BUSINESS CONTEXT (Marketing)",
        `- Position ${brand} as a premium fashion brand.`,
        `- Target: ${profile.targetAudience}. Channels: ${joinList(profile.salesChannels)}.`,
        pod
          ? "- Campaigns assume on-demand fulfillment — no warehouse or restock narratives."
          : "",
      ]
        .filter(Boolean)
        .join("\n");

    case "shopify":
      return [
        "## BUSINESS CONTEXT (Shopify)",
        pod
          ? "- Print-on-Demand / virtual inventory — Shopify tracks catalog availability, not warehouse stock."
          : "",
        "- Focus on: supplier status, POD production readiness, catalog opportunities.",
        "- Do NOT recommend: restocking, warehouse operations, physical inventory management.",
        `- Suppliers: ${joinList(profile.suppliers)}. Fulfillment: ${profile.fulfillmentModel}.`,
      ]
        .filter(Boolean)
        .join("\n");

    default:
      return "";
  }
}
