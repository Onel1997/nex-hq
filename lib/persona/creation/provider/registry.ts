/**
 * PersonaCandidateGenerator registry — Phase 2.5A provider selection.
 * OpenAI Images is the default for Official Brand Face A1 discovery.
 * fal_flux is only used when PERSONA_DISCOVERY_PROVIDER explicitly selects it.
 * Never silently fall back between OpenAI and FLUX.
 */

import type { ProviderMode } from "../../domain/creation-types";
import { resolveEffectiveProviderMode } from "./config";
import {
  DisabledCandidateGenerator,
  ManualUploadCandidateGenerator,
} from "./disabled-generator";
import { FakeCandidateGenerator } from "./fake-candidate-generator";
import { OpenAiCandidateGenerator } from "./openai-candidate-generator";
import { FalFluxCandidateGenerator } from "./fal-flux-candidate-generator";
import type { PersonaCandidateGenerator } from "./types";
import { shouldUseFakePersonaProvider } from "../paid-generation-guard";

const disabled = new DisabledCandidateGenerator();
const manual = new ManualUploadCandidateGenerator();
const openai = new OpenAiCandidateGenerator();
const fal = new FalFluxCandidateGenerator();
const fake = new FakeCandidateGenerator();

export function getPersonaCandidateGenerator(
  requestedMode: ProviderMode,
): PersonaCandidateGenerator {
  const resolved = resolveEffectiveProviderMode(requestedMode);

  if (resolved.mode === "disabled") return disabled;
  if (resolved.mode === "manual_upload") return manual;
  if (resolved.mode === "image_provider" || resolved.mode === "hybrid") {
    if (shouldUseFakePersonaProvider()) return fake;
    if (resolved.providerId === "fal_flux") {
      return fal.isConfigured() ? fal : disabled;
    }
    if (resolved.providerId === "openai") {
      return openai.isConfigured() ? openai : disabled;
    }
    // Fail closed — never silently swap providers.
    return resolved.mode === "hybrid" ? manual : disabled;
  }
  return disabled;
}

export function getProviderSetupState(requestedMode: ProviderMode) {
  return resolveEffectiveProviderMode(requestedMode);
}

export type { PersonaCandidateGenerator } from "./types";
