const OPTIONAL_CONTEXT_PLACEHOLDERS = new Set([
  "-",
  "—",
  "–",
  "n/a",
  "none",
  "null",
  "undefined",
  "unknown",
  "unbekannt",
]);

/** Sanitizes non-authoritative Design/Research hints without relaxing production truth. */
export function sanitizeOptionalProjectContextString(
  value: unknown,
  options: { minLength?: number; maxLength?: number } = {},
): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  const minLength = options.minLength ?? 2;
  const maxLength = options.maxLength ?? 300;
  if (
    candidate.length < minLength ||
    OPTIONAL_CONTEXT_PLACEHOLDERS.has(candidate.toLowerCase())
  ) {
    return undefined;
  }
  return candidate.slice(0, maxLength);
}

export function sanitizeOptionalProjectContextList(
  value: unknown,
  fallback: readonly string[],
  options: { minLength?: number; maxItems?: number } = {},
): string[] {
  const candidates = Array.isArray(value) ? value : [];
  const normalized = candidates
    .map((entry) =>
      sanitizeOptionalProjectContextString(entry, {
        minLength: options.minLength,
      }),
    )
    .filter((entry): entry is string => Boolean(entry));
  const fallbackValues = fallback
    .map((entry) => sanitizeOptionalProjectContextString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return [...new Set([...normalized, ...fallbackValues])].slice(
    0,
    options.maxItems ?? 8,
  );
}
