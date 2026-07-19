/**
 * Resolve Persona Creator provider mode from env + project settings.
 * Uses only the already-configured OpenAI Images path for paid generation.
 */

import { isOpenAiImagesConfigured } from "@/agents/image/providers/openai-images-provider";
import type { ProviderMode } from "../../domain/creation-types";

export const PERSONA_CANDIDATE_PROVIDER_ID = "openai";

export function isPersonaImageProviderConfigured(): boolean {
  return isOpenAiImagesConfigured();
}

/**
 * Effective mode for a project:
 * - disabled: never invent candidates
 * - manual_upload: upload-only workflow
 * - image_provider: OpenAI when configured
 * - hybrid: prefer provider when configured, else manual
 */
export function resolveEffectiveProviderMode(
  requested: ProviderMode,
): {
  mode: ProviderMode;
  providerConfigured: boolean;
  providerId: string | null;
  setupMessage: string | null;
} {
  const providerConfigured = isPersonaImageProviderConfigured();

  if (requested === "disabled") {
    return {
      mode: "disabled",
      providerConfigured,
      providerId: null,
      setupMessage:
        "Generierung ist deaktiviert. Nutzen Sie manuellen Upload oder aktivieren Sie image_provider.",
    };
  }

  if (requested === "manual_upload") {
    return {
      mode: "manual_upload",
      providerConfigured,
      providerId: null,
      setupMessage: null,
    };
  }

  if (requested === "image_provider" || requested === "hybrid") {
    if (!providerConfigured) {
      return {
        mode: requested === "hybrid" ? "manual_upload" : "disabled",
        providerConfigured: false,
        providerId: null,
        setupMessage:
          "OpenAI Images ist nicht konfiguriert (OPENAI_API_KEY fehlt). Generierung deaktiviert — manueller Upload möglich.",
      };
    }
    return {
      mode: requested === "hybrid" ? "hybrid" : "image_provider",
      providerConfigured: true,
      providerId: PERSONA_CANDIDATE_PROVIDER_ID,
      setupMessage: null,
    };
  }

  return {
    mode: "disabled",
    providerConfigured,
    providerId: null,
    setupMessage: "Unbekannter Provider-Modus.",
  };
}

export function defaultProviderModeForEnvironment(): ProviderMode {
  if (isPersonaImageProviderConfigured()) return "image_provider";
  return "manual_upload";
}
