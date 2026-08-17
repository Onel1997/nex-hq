export function formatPaidPrepareError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Paid Image preparation failed. Please review your selections and try again.";
  }

  const looksLikeZodPayload =
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    /invalid_format/i.test(trimmed) ||
    /"format"\s*:\s*"datetime"/i.test(trimmed);

  if (looksLikeZodPayload) {
    if (/updatedAt|capturedAt|sourceVersion|confirmationExpiresAt/i.test(trimmed)) {
      return "Shopify product metadata could not be validated. Please refresh the selected product and try again.";
    }
    return "Paid Image preparation input could not be validated. Please refresh your selections and try again.";
  }

  return trimmed.split("\n\n")[0] ?? trimmed;
}

export function logPaidPrepareValidationError(raw: string, context?: Record<string, unknown>) {
  console.error("[Image Studio] paid prepare validation failed", {
    ...context,
    detail: raw,
  });
}
