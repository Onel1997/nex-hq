import type { Persona, PersonaRelations } from "../domain/types";

export interface VideoStudioPersonaHandoff {
  personaId: string;
  personaName: string;
  relations: PersonaRelations;
}

/**
 * Phase 1.1 placeholder — Video Studio not wired.
 * Returns null always (even for video-ready personas).
 */
export function buildVideoStudioPersonaHandoff(
  persona: Persona,
  relations: PersonaRelations,
): VideoStudioPersonaHandoff | null {
  void persona;
  void relations;
  return null;
}

export function listVideoStudioIntegrationHooks(): string[] {
  return [];
}
