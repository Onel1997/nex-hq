import {
  CREATIVE_GENERATION_HTTP_MAX_BYTES,
  creativeRunSchema,
  type CreativeGenerationSetup,
  type CreativeReferenceImage,
  type CreativeReferenceSnapshot,
  type CreativeRun,
} from "@/lib/creative-studio/contracts";
import {
  xerianoClientCreditReceiptSchema,
  type XerianoClientCreditReceipt,
} from "@/lib/xeriano/client-contracts";

const CREATIVE_MULTIPART_SAFETY_BYTES = 64 * 1024;

export function estimateCreativeGenerationRequestBytes(input: {
  jobId: string;
  setup: CreativeGenerationSetup;
  references: CreativeReferenceImage[];
  referenceSnapshot?: CreativeReferenceSnapshot;
}): number {
  const encoder = new TextEncoder();
  return (
    input.references.reduce((total, reference) => total + reference.file.size, 0) +
    encoder.encode(input.jobId).byteLength +
    encoder.encode(JSON.stringify(input.setup)).byteLength +
    (input.referenceSnapshot
      ? encoder.encode(JSON.stringify(input.referenceSnapshot)).byteLength
      : 0) +
    CREATIVE_MULTIPART_SAFETY_BYTES
  );
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
  if (estimateCreativeGenerationRequestBytes(input) > CREATIVE_GENERATION_HTTP_MAX_BYTES) {
    throw new CreativeGenerationClientError(
      "Die Übertragung der ausgewählten Referenzen ist zu groß. Bitte verwende kleinere Dateien oder weniger Referenzen.",
      "REQUEST_PAYLOAD_TOO_LARGE",
    );
  }
  const formData = new FormData();
  formData.append("jobId", input.jobId);
  formData.append("setup", JSON.stringify(input.setup));
  if (input.referenceSnapshot) {
    formData.append("referenceSnapshot", JSON.stringify(input.referenceSnapshot));
  }
  for (const reference of [...input.references].sort(
    (a, b) => a.order - b.order,
  )) {
    formData.append("reference", reference.file, reference.name);
  }
  const response = await (input.fetcher ?? fetch)(
    "/api/creative-studio/generate",
    {
      method: "POST",
      body: formData,
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
