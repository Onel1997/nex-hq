/**
 * Resolve Persona Creator provider mode from env + project settings.
 * Phase 2.5A: Official Brand Face A1 discovery defaults to OpenAI Images.
 * FLUX is optional and only used when PERSONA_DISCOVERY_PROVIDER explicitly selects it.
 * Never silently fall back to FLUX when OpenAI fails / is missing.
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

function explicitDiscoveryProviderRequest():
  | "fal_flux"
  | "openai"
  | "fake"
  | null {
  const explicit = process.env.PERSONA_DISCOVERY_PROVIDER?.trim().toLowerCase();
  if (explicit === "fal_flux" || explicit === "fal" || explicit === "flux") {
    return "fal_flux";
  }
  if (explicit === "openai") return "openai";
  if (explicit === "fake") return "fake";
  return null;
}

/**
 * Effective mode for a project:
 * - disabled: never invent candidates
 * - manual_upload: upload-only workflow
 * - image_provider: OpenAI by default; fal_flux only when explicitly selected
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
  const explicit = explicitDiscoveryProviderRequest();

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
    if (explicit === "fal_flux" && !falOk) {
      return {
        mode: requested === "hybrid" ? "manual_upload" : "disabled",
        providerConfigured: false,
        providerId: null,
        setupMessage:
          "fal_flux is not configured (FAL_KEY missing). discovery_provider_not_configured",
        discoveryProviderId: "fal_flux",
      };
    }

    // Default / explicit OpenAI — fail closed; do not silently fall back to FLUX.
    if (explicit !== "fal_flux" && discoveryProviderId === "openai" && !openaiOk) {
      return {
        mode: requested === "hybrid" ? "manual_upload" : "disabled",
        providerConfigured: false,
        providerId: null,
        setupMessage:
          "OpenAI Images is not configured (OPENAI_API_KEY missing). discovery_provider_not_configured",
        discoveryProviderId: "openai",
      };
    }

    if (!providerConfigured && explicit !== "fal_flux") {
      return {
        mode: requested === "hybrid" ? "manual_upload" : "disabled",
        providerConfigured: false,
        providerId: null,
        setupMessage:
          "Kein Bild-Provider konfiguriert (OPENAI_API_KEY fehlt). Generierung deaktiviert — manueller Upload möglich.",
        discoveryProviderId: "openai",
      };
    }

    if (explicit === "fal_flux" && falOk) {
      return {
        mode: requested === "hybrid" ? "hybrid" : "image_provider",
        providerConfigured: true,
        providerId: "fal_flux",
        setupMessage: null,
        discoveryProviderId: "fal_flux",
      };
    }

    // Phase 2.5A default path: OpenAI Images.
    if (openaiOk) {
      return {
        mode: requested === "hybrid" ? "hybrid" : "image_provider",
        providerConfigured: true,
        providerId: PERSONA_CANDIDATE_PROVIDER_ID,
        setupMessage: null,
        discoveryProviderId: "openai",
      };
    }

    return {
      mode: requested === "hybrid" ? "manual_upload" : "disabled",
      providerConfigured: false,
      providerId: null,
      setupMessage:
        "OpenAI Images is not configured (OPENAI_API_KEY missing). discovery_provider_not_configured",
      discoveryProviderId: "openai",
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
  if (isOpenAiImagesConfigured() || isFalConfigured()) return "image_provider";
  return "manual_upload";
}
