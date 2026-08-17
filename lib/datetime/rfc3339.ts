import { z } from "zod";

/** Accepts ISO 8601 / RFC 3339 timestamps with `Z` or numeric offsets. */
export const rfc3339DateTimeSchema = z.string().datetime({ offset: true });

/** Normalize Postgres / Shopify timestamps to canonical UTC ISO (`…Z`). */
export function normalizeRfc3339Timestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Expected an RFC 3339 timestamp string.");
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && !trimmed.endsWith("Z")) {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return trimmed;
}

export function normalizeOptionalRfc3339Timestamp(
  value: unknown,
): string | null {
  if (value == null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  return normalizeRfc3339Timestamp(value);
}

export function parseRfc3339DateTime(value: unknown): string {
  return rfc3339DateTimeSchema.parse(normalizeRfc3339Timestamp(value));
}

export function parseOptionalRfc3339DateTime(value: unknown): string | null {
  const normalized = normalizeOptionalRfc3339Timestamp(value);
  return normalized ? rfc3339DateTimeSchema.parse(normalized) : null;
}
