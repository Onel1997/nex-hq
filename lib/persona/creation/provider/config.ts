/**
 * Resolve Persona Creator provider mode from env + project settings.
 * Phase 2.2A: Official Brand Face A1 discovery prefers fal_flux when FAL is configured.
 * OpenAI remains available. Never silently fall back from fal → OpenAI for paid A1.
 */

import { isOpenAiImagesConfigured } from "@/agents/image/providers/openai-images-provider";
import type { ProviderMode } from "../../domain/creation-types";
import {
  isFalConfigured,
  resolveConfiguredDiscoveryProviderId,
  type DiscoveryProviderId,
} from "./discovery-provider-config";

export const PERSONA_CANDIDATE_PROVIDER_ID = "openai";

export function isPersonaImageProviderConfigured(): boolean {
  return isFalConfigured() || isOpenAiImagesConfigured();
}

export function resolveActiveDiscoveryProviderId(): DiscoveryProviderId {
  return resolveConfiguredDiscoveryProviderId();
}

/**
 * Effective mode for a project:
 * - disabled: never invent candidates
 * - manual_upload: upload-only workflow
 * - image_provider: fal_flux (preferred) or openai when configured
 * - hybrid: prefer provider when configured, else manual
 */
export function resolveEffectiveProviderMode(
  requested: ProviderMode,
): {
  mode: ProviderMode;
  providerConfigured: boolean;
  providerId: string | null;
  setupMessage: string | null;
  discoveryProviderId?: DiscoveryProviderId | null;
} {
  const falOk = isFalConfigured();
  const openaiOk = isOpenAiImagesConfigured();
  const providerConfigured = falOk || openaiOk;
  const discoveryProviderId = resolveConfiguredDiscoveryProviderId();

  if (requested === "disabled") {
    return {
      mode: "disabled",
      providerConfigured,
      providerId: null,
      setupMessage:
        "Generierung ist deaktiviert. Nutzen Sie manuellen Upload oder aktivieren Sie image_provider.",
      discoveryProviderId: null,
    };
  }

  if (requested === "manual_upload") {
    return {
      mode: "manual_upload",
      providerConfigured,
      providerId: null,
      setupMessage: null,
      discoveryProviderId: null,
    };
  }

  if (requested === "image_provider" || requested === "hybrid") {
    // Explicit fal selection must fail closed — never silently bill OpenAI.
    const explicit = process.env.PERSONA_DISCOVERY_PROVIDER?.trim().toLowerCase();
    if (
      (explicit === "fal_flux" || explicit === "fal" || explicit === "flux") &&
      !falOk
    ) {
      return {
        mode: requested === "hybrid" ? "manual_upload" : "disabled",
        providerConfigured: false,
        providerId: null,
        setupMessage:
          "fal_flux is not configured (FAL_KEY missing). discovery_provider_not_configured",
        discoveryProviderId: "fal_flux",
      };
    }

    if (!providerConfigured) {
      return {
        mode: requested === "hybrid" ? "manual_upload" : "disabled",
        providerConfigured: false,
        providerId: null,
        setupMessage:
          "Kein Bild-Provider konfiguriert (FAL_KEY / OPENAI_API_KEY fehlen). Generierung deaktiviert — manueller Upload möglich.",
        discoveryProviderId: null,
      };
    }

    const providerId =
      discoveryProviderId === "fal_flux" && falOk
        ? "fal_flux"
        : discoveryProviderId === "openai" && openaiOk
          ? PERSONA_CANDIDATE_PROVIDER_ID
          : falOk
            ? "fal_flux"
            : PERSONA_CANDIDATE_PROVIDER_ID;

    return {
      mode: requested === "hybrid" ? "hybrid" : "image_provider",
      providerConfigured: true,
      providerId,
      setupMessage: null,
      discoveryProviderId: providerId as DiscoveryProviderId,
    };
  }

  return {
    mode: "disabled",
    providerConfigured,
    providerId: null,
    setupMessage: "Unbekannter Provider-Modus.",
    discoveryProviderId: null,
  };
}

export function defaultProviderModeForEnvironment(): ProviderMode {
  if (isPersonaImageProviderConfigured()) return "image_provider";
  return "manual_upload";
}
