import { createAdminClient } from "@/lib/supabase/admin";
import type { CreativeGenerationSetup, CreativeRun } from "@/lib/creative-studio/contracts";
import {
  NANO_BANANA_PRO_EDIT_MODEL_ID,
  NANO_BANANA_PRO_TEXT_MODEL_ID,
} from "@/lib/creative-studio/nano-banana-config";
import {
  KLING_MOTION_DURATION_CHOICES,
  type UgcVideoGenerationSetup,
  type UgcVideoRun,
} from "@/lib/ugc-video-studio/contracts";
import {
  assertKlingMotionReferences,
  KLING_MOTION_MAX_SECONDS,
} from "@/lib/ugc-video-studio/kling-motion-config";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import {
  quoteXerianoCredits,
  XERIANO_CREDIT_PRICING_EFFECTIVE_DATE,
  XERIANO_CREDIT_PRICING_VERSION,
} from "@/lib/xeriano/pricing";
import {
  assertPricingActivationAllowed,
  evaluateGenerationPricing,
  pricingEvaluationSnapshot,
} from "@/lib/xeriano/pricing-engine";

export type XerianoCustomerStudio = "CREATIVE_STUDIO" | "UGC_VIDEO_STUDIO";
export type XerianoCustomerOperation = "IMAGE" | "VIDEO";
export type XerianoGenerationAuthorityState =
  | "RESERVED"
  | "PROVIDER_ACCEPTED"
  | "UNKNOWN_OUTCOME"
  | "SUCCEEDED"
  | "FAILED"
  | "RELEASED";

export type XerianoCustomerCreditQuote = {
  credits: number;
  pricingVersion: typeof XERIANO_CREDIT_PRICING_VERSION;
  modelId: "nano-banana-pro" | "kling-v3-pro-motion-control";
  operation: XerianoCustomerOperation;
  studio: XerianoCustomerStudio;
  pricingSnapshot: Record<string, unknown>;
};

export type XerianoGenerationAuthority = {
  id: string;
  accountId: string;
  actorUserId: string;
  reservationId: string;
  jobId: string;
  studio: XerianoCustomerStudio;
  operation: XerianoCustomerOperation;
  state: XerianoGenerationAuthorityState;
  providerRequestId: string | null;
  quotedCredits: number;
  pricingVersion: string;
};

type AuthorityRow = {
  id: string;
  account_id: string;
  actor_user_id: string;
  reservation_id: string;
  job_id: string;
  studio: XerianoCustomerStudio;
  operation: XerianoCustomerOperation;
  state: XerianoGenerationAuthorityState;
  provider_request_id: string | null;
  pricing_snapshot: Record<string, unknown>;
};

function mapAuthority(row: AuthorityRow): XerianoGenerationAuthority {
  const quotedCredits = Number(row.pricing_snapshot?.credits);
  const pricingVersion = row.pricing_snapshot?.pricingVersion;
  if (!Number.isInteger(quotedCredits) || quotedCredits <= 0 || typeof pricingVersion !== "string") {
    throw new XerianoCustomerGenerationError(
      "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
      "Die gespeicherte Credit-Autorisierung ist ungültig.",
      503,
    );
  }
  return {
    id: row.id,
    accountId: row.account_id,
    actorUserId: row.actor_user_id,
    reservationId: row.reservation_id,
    jobId: row.job_id,
    studio: row.studio,
    operation: row.operation,
    state: row.state,
    providerRequestId: row.provider_request_id,
    quotedCredits,
    pricingVersion,
  };
}

function oneRow(data: unknown): AuthorityRow {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new XerianoCustomerGenerationError(
      "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
      "Die Credit-Autorisierung ist noch nicht verfügbar.",
      503,
    );
  }
  return value as AuthorityRow;
}

export class XerianoCustomerGenerationError extends Error {
  constructor(
    readonly code:
      | "AUTHENTICATION_REQUIRED"
      | "CUSTOMER_ACCOUNT_REQUIRED"
      | "CUSTOMER_MODEL_UNAVAILABLE"
      | "VIDEO_DURATION_REQUIRED"
      | "VIDEO_DURATION_INVALID"
      | "INSUFFICIENT_CREDITS"
      | "CONCURRENCY_LIMIT_REACHED"
      | "GENERATION_ALREADY_STARTED"
      | "ACCOUNT_NOT_ACTIVE"
      | "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE"
      | "XERIANO_CREDIT_SETTLEMENT_FAILED",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "XerianoCustomerGenerationError";
  }
}

export function quoteCreativeCustomerGeneration(
  setup: CreativeGenerationSetup,
): XerianoCustomerCreditQuote {
  if (setup.modelId !== "nano-banana-pro") {
    throw new XerianoCustomerGenerationError(
      "CUSTOMER_MODEL_UNAVAILABLE",
      "Dieses Bildmodell ist für Kunden noch nicht verfügbar.",
      400,
    );
  }
  const quoteInput = {
    modelId: "nano-banana-pro" as const,
    quality: setup.quality,
    count: setup.batchSize,
  };
  const credits = quoteXerianoCredits(quoteInput);
  const economics = evaluateGenerationPricing({
    quote: quoteInput,
    configuredCredits: credits,
    providerModelOverride: setup.references.length
      ? NANO_BANANA_PRO_EDIT_MODEL_ID
      : NANO_BANANA_PRO_TEXT_MODEL_ID,
    evaluatedAt: `${XERIANO_CREDIT_PRICING_EFFECTIVE_DATE}T00:00:00.000Z`,
  });
  assertPricingActivationAllowed(economics);
  return {
    credits,
    pricingVersion: XERIANO_CREDIT_PRICING_VERSION,
    modelId: "nano-banana-pro",
    operation: "IMAGE",
    studio: "CREATIVE_STUDIO",
    pricingSnapshot: {
      modelId: "nano-banana-pro",
      quality: setup.quality,
      count: setup.batchSize,
      credits,
      pricingVersion: XERIANO_CREDIT_PRICING_VERSION,
      economics: pricingEvaluationSnapshot(economics),
    },
  };
}

export function quoteUgcCustomerGeneration(
  setup: UgcVideoGenerationSetup,
  trustedMotionDurationSeconds?: number,
): XerianoCustomerCreditQuote {
  if (setup.modelId !== "kling-v3-pro-motion-control") {
    throw new XerianoCustomerGenerationError(
      "CUSTOMER_MODEL_UNAVAILABLE",
      "Dieses Videomodell ist für Kunden noch nicht verfügbar.",
      400,
    );
  }
  const resolution = assertKlingMotionReferences(setup);
  const detectedSeconds =
    trustedMotionDurationSeconds ?? resolution.motionVideo?.durationSeconds;
  if (!detectedSeconds || !Number.isFinite(detectedSeconds)) {
    throw new XerianoCustomerGenerationError(
      "VIDEO_DURATION_REQUIRED",
      "Die Dauer des Bewegungs-Referenzvideos konnte noch nicht bestimmt werden.",
      400,
    );
  }
  const maximum = KLING_MOTION_MAX_SECONDS[setup.klingMotion.characterOrientation];
  const selectedSeconds = Number(setup.duration);
  if (!(KLING_MOTION_DURATION_CHOICES as readonly string[]).includes(setup.duration)) {
    throw new XerianoCustomerGenerationError(
      "VIDEO_DURATION_INVALID",
      "Wähle eine unterstützte Videolänge.",
      400,
    );
  }
  if (selectedSeconds > maximum) {
    throw new XerianoCustomerGenerationError(
      "VIDEO_DURATION_INVALID",
      `Bei dieser Ausrichtung sind maximal ${maximum} Sekunden möglich.`,
      400,
    );
  }
  if (selectedSeconds > detectedSeconds + 0.05) {
    throw new XerianoCustomerGenerationError(
      "VIDEO_DURATION_INVALID",
      "Das Bewegungs-Referenzvideo ist kürzer als die gewählte Videolänge.",
      400,
    );
  }
  const billableSeconds = selectedSeconds;
  const quoteInput = {
    modelId: "kling-v3-pro-motion-control" as const,
    durationSeconds: billableSeconds,
  };
  const credits = quoteXerianoCredits(quoteInput);
  const economics = evaluateGenerationPricing({
    quote: quoteInput,
    configuredCredits: credits,
    evaluatedAt: `${XERIANO_CREDIT_PRICING_EFFECTIVE_DATE}T00:00:00.000Z`,
  });
  assertPricingActivationAllowed(economics);
  return {
    credits,
    pricingVersion: XERIANO_CREDIT_PRICING_VERSION,
    modelId: "kling-v3-pro-motion-control",
    operation: "VIDEO",
    studio: "UGC_VIDEO_STUDIO",
    pricingSnapshot: {
      modelId: "kling-v3-pro-motion-control",
      billableSeconds,
      selectedDurationSeconds: selectedSeconds,
      detectedReferenceSeconds: Number(detectedSeconds.toFixed(3)),
      characterOrientation: setup.klingMotion.characterOrientation,
      credits,
      pricingVersion: XERIANO_CREDIT_PRICING_VERSION,
      economics: pricingEvaluationSnapshot(economics),
    },
  };
}

export interface XerianoGenerationAuthorityRepository {
  find(input: { accountId: string; jobId: string }): Promise<XerianoGenerationAuthority | null>;
  authorize(input: {
    context: XerianoAccountContext;
    jobId: string;
    quote: XerianoCustomerCreditQuote;
  }): Promise<XerianoGenerationAuthority>;
  markAccepted(input: {
    accountId: string;
    jobId: string;
    providerRequestId: string;
    providerEndpoint: string;
  }): Promise<XerianoGenerationAuthority>;
  markUnknown(input: {
    accountId: string;
    jobId: string;
    providerRequestId: string | null;
    providerEndpoint: string | null;
  }): Promise<XerianoGenerationAuthority>;
  release(input: { accountId: string; jobId: string }): Promise<XerianoGenerationAuthority>;
  finalize(input: {
    accountId: string;
    jobId: string;
    status: "SUCCEEDED" | "FAILED";
  }): Promise<XerianoGenerationAuthority>;
}

function friendlyRpcError(error: { message?: string } | null): XerianoCustomerGenerationError {
  const message = error?.message ?? "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE";
  if (message.includes("INSUFFICIENT_CREDITS")) {
    return new XerianoCustomerGenerationError("INSUFFICIENT_CREDITS", "Nicht genügend Credits.", 402);
  }
  if (message.includes("CONCURRENCY_LIMIT_REACHED")) {
    return new XerianoCustomerGenerationError(
      "CONCURRENCY_LIMIT_REACHED",
      "Du hast bereits die maximale Anzahl gleichzeitiger Generierungen erreicht.",
      409,
    );
  }
  if (message.includes("ACCOUNT_NOT_ACTIVE") || message.includes("CUSTOMER_ACCOUNT_ACCESS_DENIED")) {
    return new XerianoCustomerGenerationError("ACCOUNT_NOT_ACTIVE", "Dein Account ist aktuell nicht aktiv.", 403);
  }
  if (message.includes("IDEMPOTENCY_CONFLICT") || message.includes("PROVIDER_REQUEST_ID_CONFLICT")) {
    return new XerianoCustomerGenerationError("GENERATION_ALREADY_STARTED", "Dieser Auftrag wurde bereits gestartet.", 409);
  }
  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return new XerianoCustomerGenerationError(
      "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
      "Die Credit-Autorisierung ist noch nicht verfügbar.",
      503,
    );
  }
  return new XerianoCustomerGenerationError(
    "XERIANO_CREDIT_SETTLEMENT_FAILED",
    "Die Credit-Autorisierung konnte nicht abgeschlossen werden.",
    503,
  );
}

export class SupabaseXerianoGenerationAuthorityRepository
  implements XerianoGenerationAuthorityRepository
{
  async find(input: { accountId: string; jobId: string }): Promise<XerianoGenerationAuthority | null> {
    const { data, error } = await createAdminClient()
      .from("xeriano_generation_authorities")
      .select("id,account_id,actor_user_id,reservation_id,job_id,studio,operation,state,provider_request_id,pricing_snapshot")
      .eq("account_id", input.accountId)
      .eq("job_id", input.jobId)
      .maybeSingle();
    if (error) throw friendlyRpcError(error);
    return data ? mapAuthority(data as AuthorityRow) : null;
  }

  async authorize(input: {
    context: XerianoAccountContext;
    jobId: string;
    quote: XerianoCustomerCreditQuote;
  }): Promise<XerianoGenerationAuthority> {
    const { data, error } = await createAdminClient().rpc(
      "xeriano_authorize_customer_generation",
      {
        p_account_id: input.context.accountId,
        p_actor_user_id: input.context.userId,
        p_job_id: input.jobId,
        p_idempotency_key: `customer:${input.context.accountId}:${input.quote.studio}:${input.jobId}`,
        p_model_id: input.quote.modelId,
        p_operation: input.quote.operation,
        p_pricing_version: input.quote.pricingVersion,
        p_amount: input.quote.credits,
        p_studio: input.quote.studio,
        p_pricing_snapshot: input.quote.pricingSnapshot,
      },
    );
    if (error) throw friendlyRpcError(error);
    return mapAuthority(oneRow(data));
  }

  async markAccepted(input: {
    accountId: string;
    jobId: string;
    providerRequestId: string;
    providerEndpoint: string;
  }): Promise<XerianoGenerationAuthority> {
    const { data, error } = await createAdminClient().rpc(
      "xeriano_mark_customer_generation_accepted",
      {
        p_account_id: input.accountId,
        p_job_id: input.jobId,
        p_provider_request_id: input.providerRequestId,
        p_provider_endpoint: input.providerEndpoint,
      },
    );
    if (error) throw friendlyRpcError(error);
    return mapAuthority(oneRow(data));
  }

  async markUnknown(input: {
    accountId: string;
    jobId: string;
    providerRequestId: string | null;
    providerEndpoint: string | null;
  }): Promise<XerianoGenerationAuthority> {
    const { data, error } = await createAdminClient().rpc(
      "xeriano_mark_customer_generation_unknown",
      {
        p_account_id: input.accountId,
        p_job_id: input.jobId,
        p_provider_request_id: input.providerRequestId,
        p_provider_endpoint: input.providerEndpoint,
      },
    );
    if (error) throw friendlyRpcError(error);
    return mapAuthority(oneRow(data));
  }

  async release(input: { accountId: string; jobId: string }): Promise<XerianoGenerationAuthority> {
    const { data, error } = await createAdminClient().rpc(
      "xeriano_release_customer_generation",
      { p_account_id: input.accountId, p_job_id: input.jobId },
    );
    if (error) throw friendlyRpcError(error);
    return mapAuthority(oneRow(data));
  }

  async finalize(input: {
    accountId: string;
    jobId: string;
    status: "SUCCEEDED" | "FAILED";
  }): Promise<XerianoGenerationAuthority> {
    const { data, error } = await createAdminClient().rpc(
      "xeriano_finalize_customer_generation",
      {
        p_account_id: input.accountId,
        p_job_id: input.jobId,
        p_terminal_status: input.status,
      },
    );
    if (error) throw friendlyRpcError(error);
    return mapAuthority(oneRow(data));
  }
}

export function assertCustomerGenerationContext(context: XerianoAccountContext): void {
  if (context.source !== "XERIANO_MEMBERSHIP" || context.role !== "CUSTOMER") {
    throw new XerianoCustomerGenerationError(
      "CUSTOMER_ACCOUNT_REQUIRED",
      "Für diese Generierung ist ein aktives Kundenkonto erforderlich.",
      403,
    );
  }
}

export async function reserveCustomerGeneration(input: {
  context: XerianoAccountContext;
  jobId: string;
  quote: XerianoCustomerCreditQuote;
  repository?: XerianoGenerationAuthorityRepository;
}): Promise<XerianoGenerationAuthority> {
  assertCustomerGenerationContext(input.context);
  const authority = await (
    input.repository ?? new SupabaseXerianoGenerationAuthorityRepository()
  ).authorize(input);

  // Only a still-reserved authority may cross the frozen provider boundary. A
  // replay after acceptance/settlement must observe the existing studio job
  // through its status route instead of invoking generation again.
  if (authority.state !== "RESERVED") {
    throw new XerianoCustomerGenerationError(
      "GENERATION_ALREADY_STARTED",
      "Dieser Auftrag wurde bereits gestartet.",
      409,
    );
  }

  return authority;
}

type CustomerSettleRun = Pick<CreativeRun | UgcVideoRun, "status" | "providerRequestId" | "providerModel"> & {
  updatedAt?: string;
};

export const XERIANO_STALE_SUBMISSION_OBSERVATION_MS = 10 * 60 * 1_000;

export async function settleCustomerGenerationFromRun(input: {
  context: XerianoAccountContext;
  jobId: string;
  run: CustomerSettleRun;
  repository?: XerianoGenerationAuthorityRepository;
}): Promise<XerianoGenerationAuthority> {
  const repository = input.repository ?? new SupabaseXerianoGenerationAuthorityRepository();
  const providerRequestId = input.run.providerRequestId ?? null;
  if (providerRequestId) {
    await repository.markAccepted({
      accountId: input.context.accountId,
      jobId: input.jobId,
      providerRequestId,
      providerEndpoint: input.run.providerModel ?? "fal",
    });
    if (input.run.status === "SUCCEEDED" || input.run.status === "PARTIALLY_SUCCEEDED") {
      return repository.finalize({ accountId: input.context.accountId, jobId: input.jobId, status: "SUCCEEDED" });
    }
    if (input.run.status === "FAILED") {
      return repository.finalize({ accountId: input.context.accountId, jobId: input.jobId, status: "FAILED" });
    }
    if (input.run.status === "UNKNOWN_OUTCOME") {
      return repository.markUnknown({
        accountId: input.context.accountId,
        jobId: input.jobId,
        providerRequestId,
        providerEndpoint: input.run.providerModel ?? null,
      });
    }
    return repository.markAccepted({
      accountId: input.context.accountId,
      jobId: input.jobId,
      providerRequestId,
      providerEndpoint: input.run.providerModel ?? "fal",
    });
  }
  if (input.run.status === "FAILED") {
    return repository.release({ accountId: input.context.accountId, jobId: input.jobId });
  }
  return repository.markUnknown({
    accountId: input.context.accountId,
    jobId: input.jobId,
    providerRequestId: null,
    providerEndpoint: input.run.providerModel ?? null,
  });
}

/**
 * Reconciles a persisted studio run without re-reserving or re-submitting it.
 * This is the reload/server-restart path used by UGC status polling.
 */
export async function reconcileCustomerGenerationFromRun(input: {
  context: XerianoAccountContext;
  jobId: string;
  run: CustomerSettleRun;
  repository?: XerianoGenerationAuthorityRepository;
  nowMs?: number;
}): Promise<XerianoGenerationAuthority> {
  const repository = input.repository ?? new SupabaseXerianoGenerationAuthorityRepository();
  const existing = await repository.find({
    accountId: input.context.accountId,
    jobId: input.jobId,
  });
  if (!existing) {
    throw new XerianoCustomerGenerationError(
      "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
      "Für diesen Auftrag wurde keine Credit-Autorisierung gefunden.",
      409,
    );
  }
  if (existing.state === "SUCCEEDED" || existing.state === "FAILED" || existing.state === "RELEASED") {
    return existing;
  }
  if (
    existing.state === "RESERVED" &&
    input.run.status === "RUNNING" &&
    !input.run.providerRequestId
  ) {
    const updatedAtMs = input.run.updatedAt ? Date.parse(input.run.updatedAt) : Number.NaN;
    const stale =
      Number.isFinite(updatedAtMs) &&
      (input.nowMs ?? Date.now()) - updatedAtMs >= XERIANO_STALE_SUBMISSION_OBSERVATION_MS;
    if (stale) {
      return repository.markUnknown({
        accountId: input.context.accountId,
        jobId: input.jobId,
        providerRequestId: null,
        providerEndpoint: input.run.providerModel ?? null,
      });
    }
    return existing;
  }
  if (
    existing.state === "PROVIDER_ACCEPTED" &&
    (input.run.status === "RUNNING" || input.run.status === "UNKNOWN_OUTCOME")
  ) {
    if (input.run.status === "UNKNOWN_OUTCOME") {
      return repository.markUnknown({
        accountId: input.context.accountId,
        jobId: input.jobId,
        providerRequestId: input.run.providerRequestId ?? existing.providerRequestId,
        providerEndpoint: input.run.providerModel ?? null,
      });
    }
    return existing;
  }
  return settleCustomerGenerationFromRun({ ...input, repository });
}

/**
 * Quarantines an authority when the frozen studio job cannot be observed. It
 * deliberately keeps both credits and concurrency protected and never submits.
 */
export async function quarantineCustomerGeneration(input: {
  context: XerianoAccountContext;
  jobId: string;
  providerEndpoint?: string | null;
  repository?: XerianoGenerationAuthorityRepository;
}): Promise<XerianoGenerationAuthority> {
  const repository = input.repository ?? new SupabaseXerianoGenerationAuthorityRepository();
  const existing = await repository.find({
    accountId: input.context.accountId,
    jobId: input.jobId,
  });
  if (!existing) {
    throw new XerianoCustomerGenerationError(
      "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
      "Für diesen Auftrag wurde keine Credit-Autorisierung gefunden.",
      404,
    );
  }
  if (existing.state === "SUCCEEDED" || existing.state === "FAILED" || existing.state === "RELEASED") {
    return existing;
  }
  return repository.markUnknown({
    accountId: input.context.accountId,
    jobId: input.jobId,
    providerRequestId: existing.providerRequestId,
    providerEndpoint: input.providerEndpoint ?? null,
  });
}

export async function releaseCustomerGenerationBeforeProvider(input: {
  context: XerianoAccountContext;
  jobId: string;
  repository?: XerianoGenerationAuthorityRepository;
}): Promise<void> {
  await (input.repository ?? new SupabaseXerianoGenerationAuthorityRepository()).release({
    accountId: input.context.accountId,
    jobId: input.jobId,
  });
}

export function redactCreativeRunForCustomer(run: CreativeRun): CreativeRun {
  const {
    estimatedMaximumCostUsd: _estimated,
    provider: _provider,
    providerModel: _providerModel,
    providerRequestId: _providerRequestId,
    providerPrompt: _providerPrompt,
    ...safe
  } = run;
  void _estimated;
  void _provider;
  void _providerModel;
  void _providerRequestId;
  void _providerPrompt;
  return {
    ...safe,
    results: safe.results.map(
      ({ provider: _resultProvider, providerModel: _resultModel, providerRequestId: _resultRequest, ...result }) => {
        void _resultProvider;
        void _resultModel;
        void _resultRequest;
        return result;
      },
    ),
  };
}

export function redactUgcRunForCustomer(run: UgcVideoRun): UgcVideoRun {
  const {
    estimatedMaximumCostUsd: _estimated,
    actualCostUsd: _actual,
    providerError: _providerError,
    queueObservations: _queue,
    provider: _provider,
    providerModel: _providerModel,
    providerRequestId: _providerRequestId,
    providerPrompt: _providerPrompt,
    ...safe
  } = run;
  void _estimated;
  void _actual;
  void _providerError;
  void _queue;
  void _provider;
  void _providerModel;
  void _providerRequestId;
  void _providerPrompt;
  const displayModel =
    run.setup.modelId === "kling-v3-pro-motion-control"
      ? "Kling V3 Pro Motion Control"
      : "Xeriamo Video";
  return {
    ...safe,
    results: safe.results.map((result) => ({
      ...result,
      provider: "Xeriamo",
      providerModel: displayModel,
      providerRequestId: null,
    })),
  };
}

export async function loadCustomerAvailableCredits(accountId: string): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("xeriano_credit_buckets")
    .select("remaining_credits,reserved_credits,expires_at")
    .eq("account_id", accountId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);
  if (error) throw friendlyRpcError(error);
  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.remaining_credits) - Number(row.reserved_credits),
    0,
  );
}

export function customerCreditReceipt(input: {
  authority: XerianoGenerationAuthority;
  availableCredits: number;
}) {
  return {
    quotedCredits: input.authority.quotedCredits,
    pricingVersion: input.authority.pricingVersion,
    state: input.authority.state,
    availableCredits: input.availableCredits,
  } as const;
}
