/**
 * Provider identity at the normalization boundary.
 * The fusion engine never branches on these values — provenance only.
 */

/** Opaque provider key (e.g. "pinterest", "shopify", future sources). */
export type ProviderSourceKey = string & { readonly __brand: "ProviderSourceKey" };

export function asProviderSourceKey(value: string): ProviderSourceKey {
  return value as ProviderSourceKey;
}

export type DataProvenanceMode = "live" | "simulated";

export interface ProviderProvenance {
  sourceKey: ProviderSourceKey;
  mode: DataProvenanceMode;
  syncedAt: string;
  apiVersion?: string;
}

export interface ProviderContributionManifest {
  sourceKey: ProviderSourceKey;
  mode: DataProvenanceMode;
  syncedAt: string;
  signalCount: number;
  sliceCount: number;
  domains: IntelligenceDomain[];
}

/** Domains the intelligence layer understands — provider-agnostic taxonomy. */
export type IntelligenceDomain =
  | "signal"
  | "trend"
  | "market"
  | "commercial"
  | "brand";
