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

export function listImageStudioIntegrationHooks(): string[] {
  return [];
}
