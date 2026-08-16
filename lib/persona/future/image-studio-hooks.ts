import type { Persona, PersonaRelations } from "../domain/types";
import { computePersonaReadiness } from "../domain/readiness";

export interface ImageStudioPersonaHandoff {
  personaId: string;
  personaName: string;
  relations: PersonaRelations;
}

/**
 * Phase 1.1 placeholder — Image Studio not wired.
 * Returns null always (even for image-ready personas).
 * Phase 2.4D consumer query: listImageStudioEligibleBrandModels
 * (identity_locked ∧ image_identity_ready ∧ image_use_approved ∧ brand_cast_approved).
 */
export function buildImageStudioPersonaHandoff(
  persona: Persona,
  relations: PersonaRelations,
): ImageStudioPersonaHandoff | null {
  void persona;
  void relations;
  void computePersonaReadiness;
  return null;
}

/** Hooks remain inactive until Image Studio is built. */
export function listImageStudioIntegrationHooks(): string[] {
  return [];
}
