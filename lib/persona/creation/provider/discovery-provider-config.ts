/**
 * Phase 2.2A — Brand Face Discovery provider configuration.
 * Server-side only. Never expose FAL_KEY to the browser.
 */

export const DISCOVERY_PROVIDER_IDS = ["fal_flux", "openai", "fake"] as const;
export type DiscoveryProviderId = (typeof DISCOVERY_PROVIDER_IDS)[number];

export const DEFAULT_FAL_FLUX_MODEL = "fal-ai/flux/dev";
export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "fal_flux";

/** Recommended default: up to 3 attempts per slot within confirmed budget. */
export const DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT = 3;

/** fal FLUX rough EUR band per portrait (estimated — not billing-confirmed). */
export const FAL_FLUX_IMAGE_COST_EUR_MIN = 0.02;
export const FAL_FLUX_IMAGE_COST_EUR_MAX = 0.06;

export function readFalKey(): string | null {
  const key = process.env.FAL_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function isFalConfigured(): boolean {
  return readFalKey() !== null;
}

export function resolveFalModel(): string {
  const model = process.env.PERSONA_FAL_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_FAL_FLUX_MODEL;
}

export function resolveConfiguredDiscoveryProviderId(): DiscoveryProviderId {
  const raw = process.env.PERSONA_DISCOVERY_PROVIDER?.trim().toLowerCase();
  if (raw === "openai") return "openai";
  if (raw === "fake") return "fake";
  if (raw === "fal_flux" || raw === "fal" || raw === "flux") return "fal_flux";
  // Default Official Brand Face discovery to fal_flux only when FAL is valid.
  if (isFalConfigured()) return DEFAULT_DISCOVERY_PROVIDER;
  // Do not silently fall back to OpenAI for A1 discovery when fal was expected.
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "fake";
}

export function assertDiscoveryProviderConfiguredForPaid(
  providerId: DiscoveryProviderId = resolveConfiguredDiscoveryProviderId(),
): void {
  if (providerId === "fake") return;
  if (providerId === "fal_flux" && !isFalConfigured()) {
    const err = new Error(
      "Brand Face Discovery provider fal_flux is not configured (FAL_KEY missing).",
    );
    (err as Error & { code?: string }).code = "discovery_provider_not_configured";
    throw err;
  }
  if (providerId === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error(
      "Brand Face Discovery provider openai is not configured (OPENAI_API_KEY missing).",
    );
    (err as Error & { code?: string }).code = "discovery_provider_not_configured";
    throw err;
  }
}

export function discoveryProviderDisplayName(providerId: DiscoveryProviderId): string {
  switch (providerId) {
    case "fal_flux":
      return "FLUX";
    case "openai":
      return "OpenAI Images";
    case "fake":
      return "Fake (test)";
  }
}
