/**
 * Structured Persona Studio domain errors.
 */

export type PersonaErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "WORKFLOW"
  | "UNAUTHORIZED_WORKSPACE"
  | "MISSING_APPROVAL_PREREQUISITES"
  | "INVALID_REFERENCE_ASSET"
  | "INVALID_PRIMARY_REFERENCE"
  | "STORAGE_UPLOAD_FAILED"
  | "STORAGE_DELETE_FAILED"
  | "RELATIONSHIP_INTEGRITY"
  | "CONFIG"
  | "LIVE_PAID_TEST_NOT_AUTHORIZED"
  | "PAID_GENERATION_DISABLED";

export class PersonaDomainError extends Error {
  constructor(
    message: string,
    readonly code: PersonaErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PersonaDomainError";
  }
}

/** @deprecated Use PersonaDomainError — kept for API compatibility. */
export class PersonaStoreError extends PersonaDomainError {
  constructor(
    message: string,
    code: "NOT_FOUND" | "VALIDATION" | "WORKFLOW" = "VALIDATION",
  ) {
    super(message, code);
    this.name = "PersonaStoreError";
  }
}

export class PersonaWorkflowError extends PersonaDomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "WORKFLOW", details);
    this.name = "PersonaWorkflowError";
  }
}
