import {
  ugcVideoRunSchema,
  type UgcVideoGenerationSetup,
  type UgcVideoReferenceMedia,
  type UgcVideoRun,
} from "@/lib/ugc-video-studio/contracts";
import {
  xerianoClientCreditReceiptSchema,
  type XerianoClientCreditReceipt,
} from "@/lib/xeriano/client-contracts";

export class UgcVideoGenerationClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly technicalDetails: string | null = null,
  ) {
    super(message);
    this.name = "UgcVideoGenerationClientError";
  }
}

export async function submitUgcVideoGeneration(input: {
  jobId: string;
  setup: UgcVideoGenerationSetup;
  references: UgcVideoReferenceMedia[];
  fetcher?: typeof fetch;
  onCredit?: (receipt: XerianoClientCreditReceipt) => void;
}): Promise<UgcVideoRun> {
  const formData = new FormData();
  formData.append("jobId", input.jobId);
  formData.append("setup", JSON.stringify(input.setup));
  for (const reference of [...input.references].sort(
    (a, b) => a.order - b.order,
  )) {
    formData.append("reference", reference.file, reference.name);
  }
  const response = await (input.fetcher ?? fetch)(
    "/api/ugc-video-studio/generate",
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
    throw new UgcVideoGenerationClientError(
      typeof payload?.error === "string"
        ? payload.error
        : "Das Video konnte nicht erstellt werden.",
      typeof payload?.code === "string" ? payload.code : "NETWORK_ERROR",
      typeof payload?.technicalDetails === "string"
        ? payload.technicalDetails
        : null,
    );
  }
  if (payload.credit) {
    const receipt = xerianoClientCreditReceiptSchema.safeParse(payload.credit);
    if (receipt.success) input.onCredit?.(receipt.data);
  }
  return ugcVideoRunSchema.parse(payload.run);
}

export async function fetchUgcVideoJob(input: {
  jobId: string;
  fetcher?: typeof fetch;
  onCredit?: (receipt: XerianoClientCreditReceipt) => void;
}): Promise<UgcVideoRun> {
  const response = await (input.fetcher ?? fetch)(
    `/api/ugc-video-studio/jobs/${encodeURIComponent(input.jobId)}`,
    { method: "GET", credentials: "same-origin", cache: "no-store" },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
    run?: unknown;
    credit?: unknown;
  } | null;
  if (!response.ok || !payload?.run) {
    throw new UgcVideoGenerationClientError(
      typeof payload?.error === "string"
        ? payload.error
        : "Der Videoauftrag konnte gerade nicht aktualisiert werden.",
      typeof payload?.code === "string"
        ? payload.code
        : "UGC_VIDEO_JOB_STATUS_FAILED",
    );
  }
  if (payload.credit) {
    const receipt = xerianoClientCreditReceiptSchema.safeParse(payload.credit);
    if (receipt.success) input.onCredit?.(receipt.data);
  }
  return ugcVideoRunSchema.parse(payload.run);
}
