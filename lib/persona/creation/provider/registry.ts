/**
 * PersonaCandidateGenerator registry — Phase 2.2A provider-agnostic selection.
 * fal_flux is preferred for Official Brand Face A1 when configured.
 * OpenAI remains available. Fake used in tests.
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
    if (resolved.providerId === "fal_flux" && fal.isConfigured()) return fal;
    if (openai.isConfigured()) return openai;
    return resolved.mode === "hybrid" ? manual : disabled;
  }
  return disabled;
}

export function getProviderSetupState(requestedMode: ProviderMode) {
  return resolveEffectiveProviderMode(requestedMode);
}

export type { PersonaCandidateGenerator } from "./types";
