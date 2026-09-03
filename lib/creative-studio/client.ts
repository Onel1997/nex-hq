import {
  creativeRunSchema,
  creativeGenerationSetupSchema,
  creativeReferenceSnapshotSchema,
  type CreativeGenerationSetup,
  type CreativeReferenceImage,
  type CreativeReferenceSnapshot,
  type CreativeRun,
} from "@/lib/creative-studio/contracts";
import { canonicalizeCreativeReferenceOrder } from "@/lib/creative-studio/reference-order";
import {
  xerianoClientCreditReceiptSchema,
  type XerianoClientCreditReceipt,
} from "@/lib/xeriano/client-contracts";

export function estimateCreativeGenerationRequestBytes(input: {
  jobId: string;
  setup: CreativeGenerationSetup;
  references: CreativeReferenceImage[];
  referenceSnapshot?: CreativeReferenceSnapshot;
}): number {
  const encoder = new TextEncoder();
  return encoder.encode(
    JSON.stringify(buildCreativeGenerationRequestPayload(input)),
  ).byteLength;
}

export function buildCreativeGenerationRequestPayload(input: {
  jobId: string;
  setup: CreativeGenerationSetup;
  references: CreativeReferenceImage[];
  referenceSnapshot?: CreativeReferenceSnapshot;
}) {
  const references = canonicalizeCreativeReferenceOrder(input.references);
  const setup = creativeGenerationSetupSchema.parse({
    ...input.setup,
    references: references.map((reference) => ({
      id: reference.id,
      name: reference.name,
      mimeType: reference.mimeType,
      byteLength: reference.byteLength,
      role: reference.role,
      order: reference.order,
    })),
  });
  const snapshotById = new Map(
    input.referenceSnapshot?.references.map((reference) => [
      reference.referenceId,
      reference,
    ]) ?? [],
  );
  const referenceSnapshot = input.referenceSnapshot
    ? creativeReferenceSnapshotSchema.parse({
        ...input.referenceSnapshot,
        references: references.map((reference) => ({
          referenceId: reference.id,
          order: reference.order,
          role: reference.role,
          source: reference.source,
          filename: reference.name,
          mimeType: reference.mimeType,
          byteLength: reference.byteLength,
          checksumSha256:
            snapshotById.get(reference.id)?.checksumSha256 ?? null,
        })),
      })
    : null;
  return {
    jobId: input.jobId,
    setup,
    referenceSnapshot,
    tempReferences: references.map((reference) => ({
      referenceId: reference.id,
      tempReferenceId: reference.tempReferenceId,
    })),
  };
}

export class CreativeGenerationClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly technicalDetails: string | null = null,
  ) {
    super(message);
    this.name = "CreativeGenerationClientError";
  }
}

export async function submitCreativeGeneration(input: {
  jobId: string;
  setup: CreativeGenerationSetup;
  references: CreativeReferenceImage[];
  referenceSnapshot?: CreativeReferenceSnapshot;
  fetcher?: typeof fetch;
  onCredit?: (receipt: XerianoClientCreditReceipt) => void;
}): Promise<CreativeRun> {
  if (input.references.some(
    (reference) =>
      reference.uploadState !== "READY" || !reference.tempReferenceId,
  )) {
    throw new CreativeGenerationClientError(
      "Eine Referenz wurde noch nicht vollständig hochgeladen.",
      "TEMP_REFERENCE_INCOMPLETE",
    );
  }
  const requestPayload = buildCreativeGenerationRequestPayload(input);
  const body = JSON.stringify({ ...requestPayload });
  const response = await (input.fetcher ?? fetch)(
    "/api/creative-studio/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
    technicalDetails?: unknown;
    run?: unknown;
    credit?: unknown;
  } | null;
  if (!response.ok || !payload?.run) {
    const payloadTooLarge = response.status === 413;
    throw new CreativeGenerationClientError(
      payloadTooLarge
        ? "Die Übertragung der ausgewählten Referenzen ist zu groß. Bitte verwende kleinere Dateien oder weniger Referenzen."
        : typeof payload?.error === "string"
        ? payload.error
        : "Das Bild konnte nicht erstellt werden.",
      payloadTooLarge
        ? "REQUEST_PAYLOAD_TOO_LARGE"
        : typeof payload?.code === "string"
          ? payload.code
          : "NETWORK_ERROR",
      typeof payload?.technicalDetails === "string"
        ? payload.technicalDetails
        : null,
    );
  }
  if (payload.credit) {
    const receipt = xerianoClientCreditReceiptSchema.safeParse(payload.credit);
    if (receipt.success) input.onCredit?.(receipt.data);
  }
  return creativeRunSchema.parse(payload.run);
}

export async function fetchCreativeGenerationJob(input: {
  jobId: string;
  fetcher?: typeof fetch;
  onCredit?: (receipt: XerianoClientCreditReceipt) => void;
}): Promise<CreativeRun> {
  const response = await (input.fetcher ?? fetch)(
    `/api/creative-studio/jobs/${encodeURIComponent(input.jobId)}`,
    { method: "GET", credentials: "same-origin", cache: "no-store" },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
    run?: unknown;
    credit?: unknown;
  } | null;
  if (!response.ok || !payload?.run) {
    throw new CreativeGenerationClientError(
      typeof payload?.error === "string" ? payload.error : "Der Auftrag konnte gerade nicht aktualisiert werden.",
      typeof payload?.code === "string" ? payload.code : "CREATIVE_JOB_STATUS_FAILED",
    );
  }
  if (payload.credit) {
    const receipt = xerianoClientCreditReceiptSchema.safeParse(payload.credit);
    if (receipt.success) input.onCredit?.(receipt.data);
  }
  return creativeRunSchema.parse(payload.run);
}

export async function observeCreativeGenerationJob(input: {
  jobId: string;
  fetcher?: typeof fetch;
  onCredit?: (receipt: XerianoClientCreditReceipt) => void;
}): Promise<
  | { state: "FOUND"; run: CreativeRun }
  | { state: "PREPARING" }
> {
  try {
    return {
      state: "FOUND",
      run: await fetchCreativeGenerationJob(input),
    };
  } catch (error) {
    if (
      error instanceof CreativeGenerationClientError &&
      error.code === "JOB_NOT_FOUND"
    ) {
      return { state: "PREPARING" };
    }
    throw error;
  }
}

export async function fetchCreativeAccountHistory(input: {
  fetcher?: typeof fetch;
  limit?: number;
} = {}): Promise<CreativeRun[]> {
  const response = await (input.fetcher ?? fetch)(
    `/api/creative-studio/history?limit=${Math.min(Math.max(input.limit ?? 60, 1), 60)}`,
    { method: "GET", credentials: "same-origin", cache: "no-store" },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
    runs?: unknown;
  } | null;
  if (!response.ok || !Array.isArray(payload?.runs)) {
    throw new CreativeGenerationClientError(
      typeof payload?.error === "string" ? payload.error : "Der Verlauf ist gerade nicht verfügbar.",
      typeof payload?.code === "string" ? payload.code : "CREATIVE_HISTORY_UNAVAILABLE",
    );
  }
  return payload.runs.map((run) => creativeRunSchema.parse(run));
}
