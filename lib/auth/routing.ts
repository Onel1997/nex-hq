export type NexhqAuthRoutingDecision =
  | { kind: "allow" }
  | { kind: "redirect"; location: "/" | "/login" }
  | { kind: "api_unauthorized"; status: 401 };

const PUBLIC_ASSET_PATTERN =
  /\.(?:css|js|map|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|otf|txt|xml|webmanifest)$/i;

export function isPublicNexhqPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_ASSET_PATTERN.test(pathname)
  );
}

/**
 * Single-owner routing boundary. Persona applies its own stronger allowlist
 * and workspace authorization after this general authenticated-session gate.
 */
export function decideNexhqAuthRouting(input: {
  pathname: string;
  authenticated: boolean;
}): NexhqAuthRoutingDecision {
  if (input.pathname === "/login") {
    return input.authenticated
      ? { kind: "redirect", location: "/" }
      : { kind: "allow" };
  }

  if (isPublicNexhqPath(input.pathname)) return { kind: "allow" };
  if (input.authenticated) return { kind: "allow" };

  if (input.pathname === "/api" || input.pathname.startsWith("/api/")) {
    return { kind: "api_unauthorized", status: 401 };
  }

  return { kind: "redirect", location: "/login" };
}

