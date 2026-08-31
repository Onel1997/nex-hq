import type { DesignGenerationSetup } from "@/lib/design-studio/contracts";

export const RECRAFT_CAPACITY_MESSAGE =
  "Recraft ist gerade ausgelastet. Bitte versuche es in einigen Minuten erneut oder nutze Ideogram 4.";

export type DesignProviderFailureCode = "PROVIDER_CAPACITY";

export class DesignProviderCapacityError extends Error {
  readonly code = "PROVIDER_CAPACITY" as const;

  constructor(readonly providerStatus: number | null) {
    super(RECRAFT_CAPACITY_MESSAGE);
    this.name = "DesignProviderCapacityError";
  }
}

function providerStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) ? status : null;
}

function safeSignals(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? [error.message] : [];
  }
  const record = error as Record<string, unknown>;
  const body = record.body && typeof record.body === "object"
    ? record.body as Record<string, unknown>
    : null;
  const values = [
    error instanceof Error ? error.message : null,
    record.code,
    record.type,
    body?.code,
    body?.type,
    body?.error,
    body?.message,
    body?.detail,
  ];
  return values.flatMap((value) => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!item || typeof item !== "object") return [];
      const detail = item as Record<string, unknown>;
      return [detail.code, detail.type, detail.msg, detail.message].filter((entry): entry is string => typeof entry === "string");
    });
    return [];
  });
}

/**
 * Converts only an explicit Recraft capacity signal into a safe product
 * failure. HTTP status is used as supporting provider evidence, but a generic
 * 429/503 is deliberately not enough to classify an unrelated outage as
 * capacity.
 */
export function normalizeDesignProviderError(
  error: unknown,
  model: DesignGenerationSetup["model"],
): DesignProviderCapacityError | null {
  if (model !== "RECRAFT_4") return null;
  const status = providerStatus(error);
  const signals = safeSignals(error).join(" ").toLowerCase();
  const explicitCapacity = /(?:capacity|overload|no[_ -]?available[_ -]?(?:runner|worker|model)|model[_ -]?busy)/i.test(signals);
  const capacityStatus = status === null || [409, 429, 503, 529].includes(status);
  return explicitCapacity && capacityStatus ? new DesignProviderCapacityError(status) : null;
}
