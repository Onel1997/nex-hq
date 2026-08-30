export type NexhqAuthRoutingDecision =
  | { kind: "allow" }
  | { kind: "redirect"; location: "/login" | "/app" }
  | { kind: "api_unauthorized"; status: 401 }
  | { kind: "api_forbidden"; status: 403 };

const PUBLIC_ASSET_PATTERN =
  /\.(?:css|js|map|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|otf|txt|xml|webmanifest)$/i;

export const XERIANO_STRIPE_WEBHOOK_PATH = "/api/xeriano/billing/webhook" as const;

export function isSessionlessStripeWebhookPath(pathname: string): boolean {
  return pathname === XERIANO_STRIPE_WEBHOOK_PATH;
}

export function isPublicNexhqPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname === "/impressum" ||
    pathname === "/datenschutz" ||
    pathname === "/terms" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isSessionlessStripeWebhookPath(pathname) ||
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
  internalOwner?: boolean;
}): NexhqAuthRoutingDecision {
  if (isPublicNexhqPath(input.pathname)) return { kind: "allow" };
  if (input.authenticated) {
    if (typeof input.internalOwner === "boolean" && !input.internalOwner) {
      if (input.pathname === "/app" || input.pathname.startsWith("/app/")) return { kind: "allow" };
      if (
        input.pathname.startsWith("/api/xeriano/") ||
        input.pathname.startsWith("/api/creative-studio/") ||
        input.pathname.startsWith("/api/ugc-video-studio/")
      ) return { kind: "allow" };
      if (input.pathname === "/api" || input.pathname.startsWith("/api/")) return { kind: "api_forbidden", status: 403 };
      return { kind: "redirect", location: "/app" };
    }
    return { kind: "allow" };
  }

  if (input.pathname === "/api" || input.pathname.startsWith("/api/")) {
    return { kind: "api_unauthorized", status: 401 };
  }

  return { kind: "redirect", location: "/login" };
}
