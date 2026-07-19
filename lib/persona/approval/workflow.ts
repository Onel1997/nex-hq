/**
 * Persona approval workflow transitions.
 * Prerequisites for Approved are enforced in the service layer via readiness.
 */

import type { Persona, PersonaStatus } from "../domain/types";
import { PersonaWorkflowError } from "../domain/errors";

export const PERSONA_STATUS_TRANSITIONS: Record<
  PersonaStatus,
  readonly PersonaStatus[]
> = {
  Draft: ["Review", "Archived"],
  Review: ["Draft", "Approved", "Archived"],
  Approved: ["Archived", "Review"],
  Archived: ["Draft"],
};

export function canTransitionPersonaStatus(
  from: PersonaStatus,
  to: PersonaStatus,
): boolean {
  if (from === to) return true;
  return PERSONA_STATUS_TRANSITIONS[from].includes(to);
}

export function applyPersonaStatus(
  persona: Persona,
  nextStatus: PersonaStatus,
  now = new Date().toISOString(),
): Persona {
  if (!canTransitionPersonaStatus(persona.status, nextStatus)) {
    throw new PersonaWorkflowError(
      `Cannot transition persona from ${persona.status} to ${nextStatus}`,
    );
  }

  return {
    ...persona,
    status: nextStatus,
    approved: nextStatus === "Approved",
    updated_at: now,
  };
}

export function submitPersonaForReview(persona: Persona): Persona {
  return applyPersonaStatus(persona, "Review");
}

export function approvePersona(persona: Persona): Persona {
  return applyPersonaStatus(persona, "Approved");
}

export function archivePersona(persona: Persona): Persona {
  return applyPersonaStatus(persona, "Archived");
}

export function reopenPersonaAsDraft(persona: Persona): Persona {
  return applyPersonaStatus(persona, "Draft");
}

/** @deprecated Prefer readiness-based eligibility helpers. */
export function isApprovedForProduction(
  persona: Pick<Persona, "status" | "approved">,
): boolean {
  return persona.status === "Approved" && persona.approved === true;
}

export { PersonaWorkflowError };
