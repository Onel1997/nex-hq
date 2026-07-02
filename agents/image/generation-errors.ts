import { getOpenAiImageModel } from "@/lib/image/image-generation-config";

export const OPENAI_QUOTA_USER_MESSAGE =
  "OpenAI API quota exceeded. Check Billing, Credits, or API key.";

export const OPENAI_QUOTA_ERROR_CODE = "openai_quota_exceeded" as const;

export class ImageOpenAiQuotaExceededError extends Error {
  readonly status = 429;
  readonly code = OPENAI_QUOTA_ERROR_CODE;
  readonly model?: string;
  readonly requestId?: string;
  readonly responseBody?: unknown;

  constructor(
    message: string = OPENAI_QUOTA_USER_MESSAGE,
    details?: {
      model?: string;
      requestId?: string;
      responseBody?: unknown;
    },
  ) {
    super(message);
    this.name = "ImageOpenAiQuotaExceededError";
    this.model = details?.model;
    this.requestId = details?.requestId;
    this.responseBody = details?.responseBody;
  }
}

function readHeader(
  headers: unknown,
  name: string,
): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;

  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const direct = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

export function extractOpenAiErrorDetails(
  error: unknown,
  model: string = getOpenAiImageModel(),
): {
  status?: number;
  requestId?: string;
  responseBody?: unknown;
  model: string;
} {
  if (!error || typeof error !== "object") {
    return { model, responseBody: error };
  }

  const err = error as {
    status?: number;
    message?: string;
    headers?: unknown;
    error?: unknown;
    body?: unknown;
    request_id?: string;
  };

  return {
    status: err.status,
    requestId:
      readHeader(err.headers, "x-request-id") ??
      (typeof err.request_id === "string" ? err.request_id : undefined),
    responseBody: err.error ?? err.body ?? err.message ?? error,
    model,
  };
}

export function isOpenAiQuotaError(error: unknown): boolean {
  if (error instanceof ImageOpenAiQuotaExceededError) return true;

  if (!error || typeof error !== "object") {
    return typeof error === "string" && /429|quota exceeded|exceeded your current quota/i.test(error);
  }

  const err = error as { status?: number; code?: string; message?: string };
  if (err.status === 429 || err.code === OPENAI_QUOTA_ERROR_CODE) return true;

  const message = typeof err.message === "string" ? err.message : "";
  return /429|quota exceeded|exceeded your current quota/i.test(message);
}

export function toOpenAiQuotaError(
  error: unknown,
  model: string = getOpenAiImageModel(),
): ImageOpenAiQuotaExceededError | null {
  if (!isOpenAiQuotaError(error)) return null;

  if (error instanceof ImageOpenAiQuotaExceededError) {
    return error;
  }

  const details = extractOpenAiErrorDetails(error, model);
  return new ImageOpenAiQuotaExceededError(OPENAI_QUOTA_USER_MESSAGE, details);
}
