/**
 * Phase 2.2A / 2.5A — resolve Brand Face Discovery provider.
 * OpenAI Images is the default. fal_flux only when explicitly selected.
 * Never silently fall back between OpenAI and FLUX for paid discovery.
 */

import {
  assertDiscoveryProviderConfiguredForPaid,
  resolveConfiguredDiscoveryProviderId,
  resolveFalModel,
  type DiscoveryProviderId,
} from "./discovery-provider-config";
import type { BrandFaceDiscoveryProvider } from "./brand-face-discovery-provider";
import { FalFluxDiscoveryProvider } from "./fal-flux-discovery-provider";
import { FakeBrandFaceDiscoveryProvider } from "./fake-brand-face-discovery-provider";
import { OpenAiBrandFaceDiscoveryProvider } from "./openai-brand-face-discovery-provider";
import { shouldUseFakePersonaProvider } from "../paid-generation-guard";

const fake = new FakeBrandFaceDiscoveryProvider();
const openai = new OpenAiBrandFaceDiscoveryProvider();
let falSingleton: FalFluxDiscoveryProvider | null = null;

function getFal(): FalFluxDiscoveryProvider {
  if (!falSingleton) falSingleton = new FalFluxDiscoveryProvider();
  return falSingleton;
}

export function getBrandFaceDiscoveryProvider(
  preferred?: DiscoveryProviderId,
): BrandFaceDiscoveryProvider {
  if (shouldUseFakePersonaProvider()) return fake;

  const id = preferred ?? resolveConfiguredDiscoveryProviderId();
  if (id === "fake") return fake;
  if (id === "openai") return openai;
  return getFal();
}

export function getDiscoveryProviderPreflight(preferred?: DiscoveryProviderId): {
  providerId: DiscoveryProviderId;
  providerDisplayName: string;
  providerModel: string;
  configured: boolean;
  errorCode: string | null;
  faceProtectionReady: true;
  historicalProtectionReady: true;
  slotDiversityReady: true;
} {
  const providerId = preferred ?? resolveConfiguredDiscoveryProviderId();
  const provider = getBrandFaceDiscoveryProvider(providerId);
  const configured = provider.isConfigured();
  let errorCode: string | null = null;
  try {
    if (providerId !== "fake") {
      assertDiscoveryProviderConfiguredForPaid(providerId);
    }
  } catch (error) {
    errorCode =
      error instanceof Error && "code" in error
        ? String((error as { code?: string }).code ?? "discovery_provider_not_configured")
        : "discovery_provider_not_configured";
  }

  return {
    providerId,
    providerDisplayName:
      providerId === "fal_flux"
        ? "FLUX"
        : providerId === "openai"
          ? "OpenAI Images"
          : "Fake (test)",
    providerModel:
      providerId === "fal_flux" ? resolveFalModel() : provider.modelName,
    configured: configured && errorCode === null,
    errorCode,
    faceProtectionReady: true,
    historicalProtectionReady: true,
    slotDiversityReady: true,
  };
}

export type { BrandFaceDiscoveryProvider } from "./brand-face-discovery-provider";
