import {
  DEFAULT_BUSINESS_PROFILE_SLUG,
  getBusinessProfileForSlug,
  type BusinessProfile,
} from "@/lib/business/business-profile";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";
import {
  buildSupplierIntelligence,
  formatAgentSupplierRules,
  formatSupplierIntelligencePrompt,
  getFacilitySupplierSections,
  getOperationsBusinessMeta,
  type SupplierIntelligence,
} from "@/lib/business/supplier-intelligence";
import {
  loadMarketPrintContext,
  type MarketPrintContext,
} from "@/lib/marketprint/load-marketprint-context";

export type BusinessContext = {
  profile: BusinessProfile;
  supplierIntelligence: SupplierIntelligence;
  supplierPrompt: string;
  marketPrint: MarketPrintContext;
  marketPrintPrompt: string;
  operationsMeta: ReturnType<typeof getOperationsBusinessMeta>;
  facilitySections: ReturnType<typeof getFacilitySupplierSections>;
};

function resolveWorkspaceSlug(_workspaceId: string): string {
  try {
    return getActiveWorkspaceSlug();
  } catch {
    return DEFAULT_BUSINESS_PROFILE_SLUG;
  }
}

/**
 * Load full business + supplier context for a workspace.
 *
 * V1: local registry keyed by active workspace slug.
 * Future: Supabase `business_profiles` + `supplier_connections` tables.
 */
export async function loadBusinessContext(
  workspaceId: string,
): Promise<BusinessContext> {
  const slug = resolveWorkspaceSlug(workspaceId);
  return loadBusinessContextBySlug(slug);
}

export function loadBusinessContextBySlug(slug: string): BusinessContext {
  const profile = getBusinessProfileForSlug(slug);
  const supplierIntelligence = buildSupplierIntelligence(profile);
  const marketPrint = loadMarketPrintContext();

  return {
    profile,
    supplierIntelligence,
    supplierPrompt: formatSupplierIntelligencePrompt(profile),
    marketPrint,
    marketPrintPrompt: marketPrint.prompt,
    operationsMeta: getOperationsBusinessMeta(profile),
    facilitySections: getFacilitySupplierSections(profile),
  };
}

/** Synchronous profile accessor — prefer loadBusinessContext for agents. */
export function loadBusinessProfileBySlug(slug: string): BusinessProfile {
  return getBusinessProfileForSlug(slug);
}

export async function loadBusinessProfile(
  workspaceId: string,
): Promise<BusinessProfile> {
  const ctx = await loadBusinessContext(workspaceId);
  return ctx.profile;
}

export {
  formatAgentSupplierRules,
  formatSupplierIntelligencePrompt,
  getFacilitySupplierSections,
  getOperationsBusinessMeta,
};
