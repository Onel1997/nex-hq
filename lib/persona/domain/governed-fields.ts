import { PersonaDomainError } from "./errors";

/**
 * Persona fields governed by dedicated lifecycle operations.
 *
 * These fields may be persisted by Identity Lock, identity-review, and
 * use-approval services. They must never be accepted by generic Persona CRUD.
 */
export const GOVERNED_PERSONA_FIELDS = [
  "approved",
  "identity_lock_version",
  "identity_locked_at",
  "identity_lock_status",
  "image_identity_ready",
  "video_identity_ready",
  "image_use_approved",
  "image_use_approved_at",
  "image_use_approved_by",
  "video_use_approved",
  "video_use_approved_at",
  "video_use_approved_by",
  "brand_cast_approved",
  "brand_cast_approved_at",
  "brand_cast_approved_by",
] as const;

export type GovernedPersonaField = (typeof GOVERNED_PERSONA_FIELDS)[number];

export function listGovernedPersonaFields(
  input: object,
): GovernedPersonaField[] {
  return GOVERNED_PERSONA_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(input, field),
  );
}

export function assertNoGovernedPersonaFields(
  input: object,
  operation: "create" | "update",
): void {
  const fields = listGovernedPersonaFields(input);
  if (fields.length === 0) return;

  throw new PersonaDomainError(
    `Generic Persona ${operation} cannot change governed identity or approval fields.`,
    "WORKFLOW",
    {
      operation,
      protectedFields: fields,
      requiredBoundary:
        "Use the dedicated identity review, Identity Lock, or use-approval operation.",
    },
  );
}
