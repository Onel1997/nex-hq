function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Accept the direct request origin or the explicitly configured application
 * origin. The latter is required when Next receives a LAN request through a
 * local forwarding boundary and request.url is normalized to localhost.
 */
export function isTrustedXeriamoApplicationOrigin(input: {
  originHeader: string | null;
  requestUrl: string;
  applicationUrl?: string;
}): boolean {
  const suppliedOrigin = toOrigin(input.originHeader);
  if (!suppliedOrigin) return false;

  const allowedOrigins = new Set<string>();
  const requestOrigin = toOrigin(input.requestUrl);
  const applicationOrigin = toOrigin(input.applicationUrl);
  if (requestOrigin) allowedOrigins.add(requestOrigin);
  if (applicationOrigin) allowedOrigins.add(applicationOrigin);
  return allowedOrigins.has(suppliedOrigin);
}
