/**
 * Phase 2.2A / 2.5A — Brand Face Discovery provider configuration.
 * Server-side only. Never expose FAL_KEY to the browser.
 *
 * Phase 2.5A: Official Brand Face discovery defaults to OpenAI Images.
 * FLUX remains available only when PERSONA_DISCOVERY_PROVIDER explicitly selects it.
 * Never silently fall back to FLUX when OpenAI is unavailable.
 */

export const DISCOVERY_PROVIDER_IDS = ["fal_flux", "openai", "fake"] as const;
export type DiscoveryProviderId = (typeof DISCOVERY_PROVIDER_IDS)[number];

export const DEFAULT_FAL_FLUX_MODEL = "fal-ai/flux/dev";
/** Phase 2.5A — Official Brand Face Casting default. */
export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "openai";

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

/**
 * Resolve discovery provider for NEW Official Brand Face runs.
 * Explicit PERSONA_DISCOVERY_PROVIDER wins; otherwise OpenAI is the default.
 * FLUX is never chosen implicitly just because FAL_KEY is present.
 */
export function resolveConfiguredDiscoveryProviderId(): DiscoveryProviderId {
  const raw = process.env.PERSONA_DISCOVERY_PROVIDER?.trim().toLowerCase();
  if (raw === "fal_flux" || raw === "fal" || raw === "flux") return "fal_flux";
  if (raw === "fake") return "fake";
  if (raw === "openai") return "openai";

  // Phase 2.5A default: OpenAI Images for Official Brand Face discovery.
  if (process.env.OPENAI_API_KEY?.trim()) return DEFAULT_DISCOVERY_PROVIDER;

  // No OpenAI key and no explicit provider — do not silently pick FLUX.
  // Return openai so paid preflight fails with a clear OPENAI_API_KEY message.
  // Tests without keys fall through to fake via shouldUseFakePersonaProvider.
  return DEFAULT_DISCOVERY_PROVIDER;
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
