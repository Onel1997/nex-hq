function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null | undefined): string | null {
  const first = value?.split(",", 1)[0]?.trim();
  return first || null;
}

function toProtocol(value: string | null | undefined): "http:" | "https:" | null {
  const normalized = firstForwardedValue(value)?.toLowerCase().replace(/:$/, "");
  if (normalized === "http" || normalized === "https") return `${normalized}:`;
  return null;
}

function toHostOrigin(protocol: "http:" | "https:", value: string | null | undefined): string | null {
  const host = firstForwardedValue(value);
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) return null;
  return toOrigin(`${protocol}//${host}`);
}

function isLoopbackHost(value: string | null | undefined): boolean {
  const host = firstForwardedValue(value)?.toLowerCase();
  if (!host) return false;
  return host === "localhost" || host.startsWith("localhost:") ||
    host === "127.0.0.1" || host.startsWith("127.0.0.1:") ||
    host === "[::1]" || host.startsWith("[::1]:");
}

export type XeriamoApplicationOriginAssessment = {
  allowed: boolean;
  originPresent: boolean;
  hostMatch: boolean;
};

/**
 * Evaluate a mutation Origin without trusting a LAN range or a client-supplied
 * role. In development only, the browser Origin may bind to the exact Host of
 * the current request. This covers a phone opening a Next dev server over LAN
 * even when Next normalizes request.url to localhost.
 */
export function assessTrustedXeriamoApplicationOrigin(input: {
  originHeader: string | null;
  requestUrl: string;
  applicationUrl?: string;
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtoHeader?: string | null;
  environment?: string;
}): XeriamoApplicationOriginAssessment {
  const suppliedOrigin = toOrigin(input.originHeader);
  if (!suppliedOrigin) return { allowed: false, originPresent: false, hostMatch: false };

  const allowedOrigins = new Set<string>();
  const requestOrigin = toOrigin(input.requestUrl);
  const applicationOrigin = toOrigin(input.applicationUrl);
  // A configured production application origin is canonical. The request URL
  // remains a fallback only outside that strict production configuration.
  if (requestOrigin && (input.environment !== "production" || !applicationOrigin || requestOrigin === applicationOrigin)) {
    allowedOrigins.add(requestOrigin);
  }
  if (applicationOrigin) allowedOrigins.add(applicationOrigin);

  let hostMatch = false;
  if (input.environment === "development") {
    let requestProtocol: "http:" | "https:" | null = null;
    try {
      const protocol = new URL(input.requestUrl).protocol;
      requestProtocol = protocol === "http:" || protocol === "https:" ? protocol : null;
    } catch { /* Invalid request URLs simply cannot authorize an Origin. */ }
    if (requestProtocol) {
      const hostOrigin = toHostOrigin(requestProtocol, input.hostHeader);
      if (hostOrigin && hostOrigin === suppliedOrigin) hostMatch = true;
    }
    // A forwarded host is accepted only across an explicit local forwarding
    // boundary, never as an arbitrary alternative to a non-loopback Host.
    if (isLoopbackHost(input.hostHeader)) {
      const forwardedProtocol = toProtocol(input.forwardedProtoHeader) ?? requestProtocol;
      const forwardedOrigin = forwardedProtocol
        ? toHostOrigin(forwardedProtocol, input.forwardedHostHeader)
        : null;
      if (forwardedOrigin && forwardedOrigin === suppliedOrigin) hostMatch = true;
    }
  }

  return {
    allowed: allowedOrigins.has(suppliedOrigin) || hostMatch,
    originPresent: true,
    hostMatch,
  };
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
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtoHeader?: string | null;
  environment?: string;
}): boolean {
  return assessTrustedXeriamoApplicationOrigin(input).allowed;
}
