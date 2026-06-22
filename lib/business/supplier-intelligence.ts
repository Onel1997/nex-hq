import type { AgentId } from "@/lib/constants/agents";
import type { BusinessProfile } from "@/lib/business/business-profile";
import {
  getAllSuppliers,
  isPrintOnDemand,
} from "@/lib/business/business-profile";
import {
  getPrimarySupplier,
  getSecondarySuppliers,
  type SupplierProfile,
} from "@/lib/business/supplier-profile";

export type SupplierIntelligence = {
  businessModel: string;
  inventoryModel: string;
  warehouse: string;
  fulfillment: string;
  primarySupplier: SupplierProfile;
  secondarySuppliers: SupplierProfile[];
  connectedApps: BusinessProfile["connectedApps"];
  productionRules: string[];
  marketingRules: string[];
};

export type FacilitySupplierSection = {
  title: string;
  lines: string[];
};

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none configured)";
}

export function buildSupplierIntelligence(
  profile: BusinessProfile,
): SupplierIntelligence {
  const pod = isPrintOnDemand(profile);

  return {
    businessModel: profile.businessModel,
    inventoryModel: profile.inventoryModel,
    warehouse: profile.warehouse,
    fulfillment: profile.fulfillment,
    primarySupplier: getPrimarySupplier(),
    secondarySuppliers: getSecondarySuppliers(),
    connectedApps: profile.connectedApps,
    productionRules: pod
      ? [
          "No warehouse — supplier produces on demand",
          "MarketPrint is the default production partner",
          "Verify supplier catalog sync before listing changes",
          "Embroidery and print placement follow supplier specs",
        ]
      : ["Follow configured fulfillment model"],
    marketingRules: pod
      ? [
          "No fake scarcity or low-stock campaigns",
          "No warehouse or restock messaging",
          "Focus on storytelling, capsule drops, premium positioning",
          "Scarcity reflects real demand only",
        ]
      : [],
  };
}

/** Global supplier block for agent system prompts. */
export function formatSupplierIntelligencePrompt(
  profile: BusinessProfile,
): string {
  const intel = buildSupplierIntelligence(profile);
  const primary = intel.primarySupplier;

  return [
    "## SUPPLIER INTELLIGENCE",
    "",
    `Business Model:\n${intel.businessModel}`,
    "",
    `Inventory:\n${intel.inventoryModel}`,
    "",
    `Warehouse:\n${intel.warehouse}`,
    "",
    `Fulfillment:\n${intel.fulfillment}`,
    "",
    `Primary Supplier:\n${primary.name}`,
    "",
    `Secondary Suppliers:\n${joinList(intel.secondarySuppliers.map((s) => s.name))}`,
    "",
    "Primary Supplier Capabilities:",
    ...primary.capabilities.map((c) => `- ${c}`),
    "",
    "Production Limitations:",
    ...primary.limitations.map((l) => `- ${l}`),
    "",
    "Connected Apps (future API):",
    joinList(intel.connectedApps),
    "",
    "Rules:",
    ...intel.productionRules.map((r) => `- ${r}`),
    ...intel.marketingRules.map((r) => `- ${r}`),
  ].join("\n");
}

/** Agent-specific supplier context. */
export function formatAgentSupplierRules(
  agentId: AgentId,
  profile: BusinessProfile,
): string {
  const intel = buildSupplierIntelligence(profile);
  const pod = isPrintOnDemand(profile);
  const primary = intel.primarySupplier.name;

  switch (agentId) {
    case "ceo":
      return [
        "## SUPPLIER CONTEXT (CEO)",
        pod
          ? "- Milaene is a Print On Demand brand — supplier ecosystem, not warehouse operations."
          : "",
        `- Primary production partner: ${primary}.`,
        `- Secondary options: ${joinList(profile.secondarySuppliers)}.`,
        "- Understand production limitations and supplier opportunities.",
        "- Never recommend warehouse, restocking, or physical inventory solutions.",
        "- Evaluate catalog gaps through supplier capability, not stock levels.",
      ]
        .filter(Boolean)
        .join("\n");

    case "designer":
      return [
        "## SUPPLIER CONTEXT (Design)",
        `- Default to ${primary} capabilities and product catalog.`,
        "- Designs must respect POD limitations: print areas, embroidery constraints, realistic materials.",
        "- Recommend secondary suppliers only for new categories MarketPrint cannot cover.",
        `- Secondary pool: ${joinList(profile.secondarySuppliers)}.`,
      ].join("\n");

    case "image":
      return [
        "## SUPPLIER CONTEXT (Image)",
        "- Visuals must reflect real POD products and supplier materials.",
        `- ${primary}: respect embroidery and print placement limits.`,
        "- No mockups implying unavailable production techniques.",
        "- Show realistic garment textures and premium streetwear styling.",
      ].join("\n");

    case "marketing":
      return [
        "## SUPPLIER CONTEXT (Marketing)",
        "- Avoid fake scarcity, low-stock campaigns, and warehouse messaging.",
        "- Focus on storytelling, capsule drops, and premium positioning.",
        "- Scarcity reflects real demand only — not Shopify virtual inventory counts.",
        `- Fulfillment: ${profile.fulfillment} via ${primary}.`,
      ].join("\n");

    case "shopify":
      return [
        "## SUPPLIER CONTEXT (Shopify)",
        `Primary Supplier: ${primary}`,
        `Business Model: ${profile.businessModel}`,
        `Fulfillment: ${profile.fulfillment}`,
        "- Replace warehouse logic with supplier status checks.",
        "- SUPPLIER STATUS / SUPPLIER UNAVAILABLE / SUPPLIER CHECK — not stock or restock.",
        "- No restock or warehouse recommendations.",
      ].join("\n");

    default:
      return "";
  }
}

/** Facility inspector sections keyed by agent lab. */
export function getFacilitySupplierSections(
  profile: BusinessProfile,
): Partial<Record<AgentId, FacilitySupplierSection[]>> {
  const intel = buildSupplierIntelligence(profile);

  return {
    ceo: [
      {
        title: "Supplier Ecosystem",
        lines: [
          `Primary: ${intel.primarySupplier.name}`,
          `Secondary: ${joinList(profile.secondarySuppliers)}`,
          `Model: ${profile.businessModel} · ${profile.fulfillment}`,
          "No warehouse — production and fulfillment via suppliers",
        ],
      },
    ],
    shopify: [
      {
        title: "Production Model",
        lines: [
          profile.businessModel,
          `Inventory: ${profile.inventoryModel}`,
          `Warehouse: ${profile.warehouse}`,
        ],
      },
      {
        title: "Supplier Model",
        lines: [
          `Primary: ${intel.primarySupplier.name}`,
          `Fulfillment: ${profile.fulfillment}`,
          `Secondary: ${joinList(profile.secondarySuppliers.slice(0, 3))}`,
        ],
      },
    ],
    marketing: [
      {
        title: "Brand Model",
        lines: [
          profile.marketingStyle,
          profile.productStrategy,
          `Positioning: ${profile.positioning}`,
        ],
      },
    ],
  };
}

/** Shopify operations header metadata. */
export function getOperationsBusinessMeta(profile: BusinessProfile): {
  primarySupplier: string;
  businessModel: string;
  fulfillment: string;
} {
  return {
    primarySupplier: profile.primarySupplier,
    businessModel: profile.businessModel,
    fulfillment: profile.fulfillment,
  };
}

/** Map Shopify virtual inventory signals to supplier terminology. */
export type SupplierAvailabilityStatus =
  | "active"
  | "supplier_status"
  | "supplier_unavailable";

export const SUPPLIER_STATUS_LABELS: Record<SupplierAvailabilityStatus, string> =
  {
    active: "Active",
    supplier_status: "Supplier Status",
    supplier_unavailable: "Supplier Unavailable",
  };

export function resolveSupplierAvailabilityStatus(input: {
  status: string;
  inventory: number;
  lowThreshold?: number;
}): SupplierAvailabilityStatus {
  const threshold = input.lowThreshold ?? 5;
  if (input.status !== "ACTIVE") return "supplier_unavailable";
  if (input.inventory <= 0) return "supplier_unavailable";
  if (input.inventory <= threshold) return "supplier_status";
  return "active";
}

export function formatSupplierCheckMessage(
  productTitle: string,
  profile: BusinessProfile,
): string {
  return `Supplier Check: ${productTitle} — verify with ${profile.primarySupplier}.`;
}

export function formatSupplierStatusMessage(
  productTitle: string,
  inventory: number,
  profile: BusinessProfile,
): string {
  return `Supplier Status: ${productTitle} — ${inventory} virtual units; confirm POD availability with ${profile.primarySupplier}.`;
}

export function formatSupplierUnavailableMessage(productTitle: string): string {
  return `Supplier Unavailable: ${productTitle} — check supplier catalog sync or disable listing.`;
}
