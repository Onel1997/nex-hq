import type { UgcVideoProviderError } from "@/lib/ugc-video-studio/contracts";

export const UGC_VIDEO_PROVIDER_BODY_MAX_BYTES = 24 * 1024;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const SECRET_KEY =
  /authorization|api[-_]?key|fal[-_]?key|token|secret|credential|cookie|signed[-_]?url|upload[-_]?url/i;

type MutableSanitization = { truncated: boolean };

function sanitizeText(value: string, maximum = 4000): string {
  const withoutCredentials = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[REDACTED_URL]");
  return withoutCredentials.slice(0, maximum);
}

function sanitizeValue(
  value: unknown,
  state: MutableSanitization,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 4000) state.truncated = true;
    return sanitizeText(value);
  }
  if (typeof value !== "object") return String(value).slice(0, 500);
  if (seen.has(value)) {
    state.truncated = true;
    return "[CIRCULAR]";
  }
  if (depth >= MAX_DEPTH) {
    state.truncated = true;
    return "[MAX_DEPTH]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) state.truncated = true;
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, state, depth + 1, seen));
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_OBJECT_KEYS) state.truncated = true;
  return Object.fromEntries(
    entries.slice(0, MAX_OBJECT_KEYS).map(([key, item]) => [
      key.slice(0, 200),
      SECRET_KEY.test(key)
        ? "[REDACTED]"
        : sanitizeValue(item, state, depth + 1, seen),
    ]),
  );
}

function boundUtf8(value: string, state: MutableSanitization): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= UGC_VIDEO_PROVIDER_BODY_MAX_BYTES) return value;
  state.truncated = true;
  return bytes
    .subarray(0, UGC_VIDEO_PROVIDER_BODY_MAX_BYTES)
    .toString("utf8")
    .replace(/\uFFFD$/u, "");
}

function objectValue(value: unknown, key: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function sanitizeFalProviderError(input: {
  error: unknown;
  phase: UgcVideoProviderError["phase"];
  endpoint: string;
  requestId: string | null;
  occurredAt?: string;
}): UgcVideoProviderError {
  const error = input.error as {
    status?: unknown;
    body?: unknown;
    requestId?: unknown;
    message?: unknown;
    code?: unknown;
  } | null;
  const body = error?.body;
  const bodyError = objectValue(body, "error");
  const bodyDetail = objectValue(body, "detail");
  const state: MutableSanitization = { truncated: false };
  const sanitized = body === undefined
    ? null
    : sanitizeValue(body, state, 0, new WeakSet());
  const serialized = sanitized === null
    ? null
    : boundUtf8(
        typeof sanitized === "string"
          ? sanitized
          : JSON.stringify(sanitized),
        state,
      );
  const providerCode = firstText(
    error?.code,
    objectValue(body, "code"),
    objectValue(bodyError, "code"),
    objectValue(bodyDetail, "code"),
    objectValue(bodyDetail, "type"),
  );
  const providerMessage = sanitizeText(
    firstText(
      objectValue(body, "message"),
      objectValue(bodyError, "message"),
      typeof bodyDetail === "string" ? bodyDetail : null,
      error?.message,
      "Unbekannter Anbieterfehler",
    )!,
  );
  const rawStatus = error?.status;
  return {
    phase: input.phase,
    httpStatus:
      typeof rawStatus === "number" && Number.isInteger(rawStatus)
        ? rawStatus
        : null,
    providerCode: providerCode ? sanitizeText(providerCode, 500) : null,
    providerMessage,
    providerBody: serialized,
    requestId: sanitizeText(
      firstText(error?.requestId, input.requestId) ?? "",
      500,
    ) || null,
    endpoint: sanitizeText(input.endpoint, 1000),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    truncated: state.truncated,
  };
}

export function sanitizeFalQueueText(value: string): string {
  return sanitizeText(value, 1000);
}
