/**
 * Guards against unauthorized live paid Persona provider invocation.
 * No paid OpenAI call without explicit multi-factor confirmation + env allow.
 */

import { PersonaDomainError } from "../domain/errors";
import type {
  CandidateGenerationCostEstimate,
  PersonaCreationProject,
  PersonaGenerationConfirmation,
  ProviderMode,
} from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";

export const ALLOW_LIVE_PERSONA_GENERATION_TESTS_ENV =
  "ALLOW_LIVE_PERSONA_GENERATION_TESTS";
export const EXPECTED_SUPABASE_PROJECT_REF_ENV =
  "EXPECTED_SUPABASE_PROJECT_REF";
export const LIVE_PERSONA_GENERATION_MAX_EUR_ENV =
  "LIVE_PERSONA_GENERATION_MAX_EUR";
export const PERSONA_USE_FAKE_PROVIDER_ENV = "PERSONA_USE_FAKE_PROVIDER";
export const PERSONA_PAID_GENERATION_ENABLED_ENV = "PERSONA_PAID_GENERATION_ENABLED";

/** Normal UI attestation — server requires matching confirmation + userConfirmedAt. */
export const UI_CHECKBOX_ATTESTATION = "ui_checkbox" as const;

/** Prepared estimate + confirmation valid for this window. */
export const CONFIRMATION_TTL_MS = 30 * 60 * 1000;

export type PaidConfirmationIntent = "initial" | "retry";

export function isAutomatedTestEnvironment(): boolean {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.VITEST === "1"
  ) {
    return true;
  }
  // tsx/node --test may run with NODE_ENV=development when .env.local is loaded
  if (process.argv.includes("--test")) return true;
  if (process.env.npm_lifecycle_event === "test") return true;
  return false;
}

export const PERSONA_FORCE_LIVE_PROVIDER_GUARD_ENV =
  "PERSONA_FORCE_LIVE_PROVIDER_GUARD";

export function shouldUseFakePersonaProvider(): boolean {
  if (process.env[PERSONA_USE_FAKE_PROVIDER_ENV] === "true") return true;
  if (process.env[PERSONA_FORCE_LIVE_PROVIDER_GUARD_ENV] === "1") return false;
  if (isAutomatedTestEnvironment()) return true;
  return false;
}

export function isLivePersonaGenerationTestsAllowed(): boolean {
  return process.env[ALLOW_LIVE_PERSONA_GENERATION_TESTS_ENV] === "true";
}

/** Master switch — default false when unset. Real paid execution requires explicit true. */
export function isPaidGenerationEnabled(): boolean {
  return process.env[PERSONA_PAID_GENERATION_ENABLED_ENV] === "true";
}

export function assertPaidGenerationEnabled(): void {
  if (shouldUseFakePersonaProvider()) return;
  if (!isPaidGenerationEnabled()) {
    throw new PersonaDomainError(
      "Kostenpflichtige Generierung ist derzeit gesperrt.",
      "PAID_GENERATION_DISABLED",
      { paidGenerationEnabled: false },
    );
  }
}

export function isOpenAiApiKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getPaidGenerationSafetyStatus(): {
  openaiApiKeyConfigured: boolean;
  paidGenerationEnabled: boolean;
  fakeProviderActive: boolean;
  liveTestsEnabled: boolean;
} {
  return {
    openaiApiKeyConfigured: isOpenAiApiKeyConfigured(),
    paidGenerationEnabled: isPaidGenerationEnabled(),
    fakeProviderActive: shouldUseFakePersonaProvider(),
    liveTestsEnabled: isLivePersonaGenerationTestsAllowed(),
  };
}

export function isConfirmationCancelledOrExpired(
  confirmation: PersonaGenerationConfirmation,
): boolean {
  const payload = confirmation.payload ?? {};
  if (payload.expired === true) return true;
  const cleanup = payload.incident_cleanup as
    | { status?: string }
    | undefined;
  return cleanup?.status === "cancelled" || cleanup?.status === "expired";
}

export function assertConfirmationUsable(
  confirmation: PersonaGenerationConfirmation,
): void {
  if (confirmation.consumed_at) {
    throw new PersonaDomainError(
      "Bestätigung wurde bereits verwendet — neue Kostenschätzung erforderlich.",
      "WORKFLOW",
      { reusedConfirmation: true },
    );
  }
  if (isConfirmationCancelledOrExpired(confirmation)) {
    throw new PersonaDomainError(
      "Bestätigung wurde storniert oder ist abgelaufen.",
      "WORKFLOW",
      { expiredConfirmation: true },
    );
  }
}

/** UI attestation string alone never authorizes — requires confirmation record + timestamp. */
export function assertValidUiAttestation(args: {
  attestation: string | undefined;
  userConfirmedAt: string | undefined;
  confirmation: PersonaGenerationConfirmation;
  request?: Request;
}): void {
  const { attestation, userConfirmedAt, confirmation, request } = args;

  if (request && isDebugOrTestHttpRequest(request)) {
    throw new PersonaDomainError(
      "Debug-/Test-Header dürfen keine normale UI-Generierung autorisieren.",
      "LIVE_PAID_TEST_NOT_AUTHORIZED",
      { debugHeaderRejected: true },
    );
  }

  if (attestation !== UI_CHECKBOX_ATTESTATION) {
    throw new PersonaDomainError(
      "Gültige UI-Bestätigung (attestation: ui_checkbox) erforderlich.",
      "WORKFLOW",
      { requiresUiAttestation: true },
    );
  }

  assertValidUserConfirmationTimestamp(userConfirmedAt, confirmation);

  const preparedMs = parseIsoMs(confirmation.created_at);
  const userMs = parseIsoMs(userConfirmedAt ?? "");
  if (preparedMs != null && userMs != null && userMs < preparedMs) {
    throw new PersonaDomainError(
      "Nutzerbestätigung liegt vor der Kostenschätzung — ungültig.",
      "WORKFLOW",
      { requiresUserConfirmation: true },
    );
  }
}

function resolvedSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? process.env.SUPABASE_PROJECT_REF ?? null;
}

export function assertLivePaidProviderInvocationAllowed(options?: {
  estimatedMaxEur?: number;
}): void {
  if (shouldUseFakePersonaProvider()) return;

  if (isLivePersonaGenerationTestsAllowed()) {
    const expectedRef = process.env[EXPECTED_SUPABASE_PROJECT_REF_ENV];
    if (expectedRef) {
      const actualRef = resolvedSupabaseProjectRef();
      if (actualRef !== expectedRef) {
        throw new PersonaDomainError(
          `Live-Test Supabase-Projekt stimmt nicht überein (erwartet ${expectedRef}).`,
          "LIVE_PAID_TEST_NOT_AUTHORIZED",
          { expectedRef, actualRef },
        );
      }
    }

    const maxRaw = process.env[LIVE_PERSONA_GENERATION_MAX_EUR_ENV];
    if (maxRaw && options?.estimatedMaxEur != null) {
      const max = Number(maxRaw);
      if (Number.isFinite(max) && options.estimatedMaxEur > max) {
        throw new PersonaDomainError(
          `Geschätzte Kosten (${options.estimatedMaxEur.toFixed(2)} €) überschreiten LIVE_PERSONA_GENERATION_MAX_EUR (${max} €).`,
          "LIVE_PAID_TEST_NOT_AUTHORIZED",
          { estimatedMaxEur: options.estimatedMaxEur, maxEur: max },
        );
      }
    }
    return;
  }

  if (isPaidGenerationEnabled()) return;

  throw new PersonaDomainError(
    "Kostenpflichtige Generierung ist derzeit gesperrt.",
    "PAID_GENERATION_DISABLED",
    { paidGenerationEnabled: false },
  );
}

export function isPaidProviderMode(mode: ProviderMode): boolean {
  return mode === "image_provider" || mode === "hybrid";
}

export function parseIsoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** UI must send ISO timestamp when user explicitly confirms cost checkbox. */
export function assertValidUserConfirmationTimestamp(
  userConfirmedAt: string | undefined,
  confirmation: PersonaGenerationConfirmation,
  nowMs = Date.now(),
): void {
  if (!userConfirmedAt?.trim()) {
    throw new PersonaDomainError(
      "Explizite Nutzerbestätigung (userConfirmedAt) fehlt.",
      "WORKFLOW",
      { requiresUserConfirmation: true },
    );
  }
  const userMs = parseIsoMs(userConfirmedAt);
  const preparedMs = parseIsoMs(confirmation.created_at);
  if (userMs == null) {
    throw new PersonaDomainError(
      "Ungültiger userConfirmedAt-Zeitstempel.",
      "VALIDATION",
    );
  }
  if (preparedMs == null) {
    throw new PersonaDomainError(
      "Bestätigungsdatensatz beschädigt (created_at fehlt).",
      "VALIDATION",
    );
  }
  if (userMs < preparedMs) {
    throw new PersonaDomainError(
      "Nutzerbestätigung liegt vor der Kostenschätzung — ungültig.",
      "WORKFLOW",
      { requiresUserConfirmation: true },
    );
  }
  if (nowMs - preparedMs > CONFIRMATION_TTL_MS) {
    throw new PersonaDomainError(
      "Kostenschätzung abgelaufen — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true, expired: true },
    );
  }
  if (nowMs - userMs > CONFIRMATION_TTL_MS) {
    throw new PersonaDomainError(
      "Nutzerbestätigung abgelaufen — bitte erneut bestätigen.",
      "WORKFLOW",
      { requiresUserConfirmation: true, expired: true },
    );
  }
}

export function confirmationIntent(
  confirmation: PersonaGenerationConfirmation,
): PaidConfirmationIntent {
  const intent = confirmation.payload?.intent;
  return intent === "retry" ? "retry" : "initial";
}

export function assertConfirmationMatchesGenerationRequest(args: {
  scope: WorkspaceScope;
  project: PersonaCreationProject;
  confirmation: PersonaGenerationConfirmation;
  estimate: CandidateGenerationCostEstimate;
  estimateHash: string;
  qualityMode: string;
}): void {
  const { scope, project, confirmation, estimate, estimateHash, qualityMode } =
    args;

  if (confirmation.workspace_id !== scope.workspaceId) {
    throw new PersonaDomainError(
      "Bestätigung gehört zu einem anderen Workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
  if (confirmation.creation_project_id !== project.id) {
    throw new PersonaDomainError(
      "Bestätigung gehört zu einem anderen Creation-Projekt.",
      "WORKFLOW",
    );
  }
  if (confirmation.consumed_at) {
    throw new PersonaDomainError(
      "Bestätigung wurde bereits verwendet — neue Kostenschätzung erforderlich.",
      "WORKFLOW",
      { reusedConfirmation: true },
    );
  }
  if (isConfirmationCancelledOrExpired(confirmation)) {
    throw new PersonaDomainError(
      "Bestätigung wurde storniert oder ist abgelaufen.",
      "WORKFLOW",
      { expiredConfirmation: true },
    );
  }
  if (confirmation.estimate_hash !== estimateHash) {
    throw new PersonaDomainError(
      "Kostenschätzung veraltet oder Parameter geändert — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true },
    );
  }
  if (confirmation.stage !== project.generation_stage) {
    throw new PersonaDomainError(
      "Generierungsstufe geändert — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true },
    );
  }
  if (confirmation.quality_mode !== qualityMode) {
    throw new PersonaDomainError(
      "Qualitätsmodus geändert — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true },
    );
  }
  if (confirmation.candidate_count !== estimate.candidateCount) {
    throw new PersonaDomainError(
      "Kandidatenanzahl geändert — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true },
    );
  }
  if (confirmation.asset_count !== estimate.totalImages) {
    throw new PersonaDomainError(
      "Asset-Anzahl geändert — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true },
    );
  }

  const payloadProvider = confirmation.payload?.provider;
  if (
    typeof payloadProvider === "string" &&
    payloadProvider.length > 0 &&
    payloadProvider !== estimate.provider
  ) {
    throw new PersonaDomainError(
      "Provider geändert — neue Bestätigung erforderlich.",
      "WORKFLOW",
      { requiresReconfirmation: true },
    );
  }

  const intent = confirmationIntent(confirmation);
  if (project.actual_cost > 0 && intent !== "retry") {
    throw new PersonaDomainError(
      "Erneute bezahlte Generierung erfordert eine neue Retry-Bestätigung (prepare_confirmation).",
      "WORKFLOW",
      { requiresRetryConfirmation: true },
    );
  }

  if (
    scope.actorId &&
    scope.actorId !== "workspace-user" &&
    confirmation.created_by &&
    confirmation.created_by !== "workspace-user" &&
    confirmation.created_by !== scope.actorId
  ) {
    throw new PersonaDomainError(
      "Bestätigung gehört zu einem anderen Benutzer.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
}

const PAID_PROVIDER_IDS = new Set(["openai"]);

export function isDebugOrUnattestedGenerationJob(job: {
  confirmation_payload?: Record<string, unknown>;
  created_by?: string | null;
  provider?: string;
  status?: string;
}): boolean {
  const payload = job.confirmation_payload ?? {};
  if (payload.attestation === "debug_or_api_only") return true;

  const provider = job.provider ?? "";
  const isPaidRun = PAID_PROVIDER_IDS.has(provider);

  if (!isPaidRun) return false;

  const terminalOrActive =
    job.status == null ||
    ["queued", "generating", "completed", "partially_completed", "failed"].includes(
      job.status,
    );
  if (!terminalOrActive) return false;

  return payload.attestation !== "ui_checkbox" || payload.userConfirmedAt == null;
}

export function isDebugOrTestHttpRequest(request: Request): boolean {
  const headers = request.headers;
  if (headers.get("x-debug") === "1" || headers.get("x-test-mode") === "1") {
    return true;
  }
  if (headers.get("x-nexhq-internal-test") === "1") {
    return true;
  }
  return false;
}

export function assertPaidGenerationHttpRequestAllowed(request: Request): void {
  if (!isDebugOrTestHttpRequest(request)) return;
  if (shouldUseFakePersonaProvider()) return;
  if (isLivePersonaGenerationTestsAllowed()) return;
  throw new PersonaDomainError(
    "Kostenpflichtige Provider-Tests sind nicht ausdrücklich freigegeben.",
    "LIVE_PAID_TEST_NOT_AUTHORIZED",
  );
}
