/**
 * PersonaCandidateGenerator registry — single configured image provider only.
 */

import type { ProviderMode } from "../../domain/creation-types";
import { resolveEffectiveProviderMode } from "./config";
import {
  DisabledCandidateGenerator,
  ManualUploadCandidateGenerator,
} from "./disabled-generator";
import { OpenAiCandidateGenerator } from "./openai-candidate-generator";
import type { PersonaCandidateGenerator } from "./types";

const disabled = new DisabledCandidateGenerator();
const manual = new ManualUploadCandidateGenerator();
const openai = new OpenAiCandidateGenerator();

export function getPersonaCandidateGenerator(
  requestedMode: ProviderMode,
): PersonaCandidateGenerator {
  const resolved = resolveEffectiveProviderMode(requestedMode);

  if (resolved.mode === "disabled") return disabled;
  if (resolved.mode === "manual_upload") return manual;
  if (resolved.mode === "image_provider" || resolved.mode === "hybrid") {
    if (openai.isConfigured()) return openai;
    return resolved.mode === "hybrid" ? manual : disabled;
  }
  return disabled;
}

export function getProviderSetupState(requestedMode: ProviderMode) {
  return resolveEffectiveProviderMode(requestedMode);
}

export type { PersonaCandidateGenerator } from "./types";
