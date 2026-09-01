const PUBLIC_FRONTEND_PATHS = new Set([
  "/",
  "/pricing",
  "/login",
  "/register",
  "/reset-password",
]);

/** Public/customer HTML surfaces replaced by the Maintenance page. */
export function isMaintenanceFrontendPath(pathname: string): boolean {
  return PUBLIC_FRONTEND_PATHS.has(pathname) || pathname === "/app" || pathname.startsWith("/app/");
}

/**
 * New customer-originating product writes that must fail before account,
 * quote, reservation or provider execution while Maintenance is active.
 * Recovery polling, provider callbacks, settlement and upload completion are
 * deliberately absent.
 */
export function isMaintenanceBlockedCustomerMutation(input: {
  pathname: string;
  method: string;
}): boolean {
  const method = input.method.toUpperCase();
  const pathname = input.pathname;
  if (method === "POST" && [
    "/api/creative-studio/generate",
    "/api/design-studio/generate",
    "/api/design-studio/utility",
    "/api/design-studio/svg-to-png",
    "/api/ugc-video-studio/generate",
    "/api/xeriano/library",
    "/api/xeriano/library/import",
    "/api/xeriano/temp-references",
    "/api/xeriano/billing/checkout",
    "/api/xeriano/billing/portal",
  ].includes(pathname)) return true;

  if ((method === "PATCH" || method === "DELETE") && /^\/api\/xeriano\/library\/[0-9a-f-]+$/i.test(pathname)) return true;
  if (method === "PATCH" && /^\/api\/xeriano\/creations\/[0-9a-f-]+$/i.test(pathname)) return true;
  return false;
}

export function maintenanceReturnPath(pathname: string, search: string): string {
  if (!isMaintenanceFrontendPath(pathname)) return "/";
  const candidate = `${pathname}${search}`;
  return candidate.length <= 1_000 ? candidate : "/";
}

export function maintenanceDecision(input: {
  enabled: boolean;
  pathname: string;
  method: string;
  exactOwner: boolean;
}): "ALLOW" | "MAINTENANCE_PAGE" | "MAINTENANCE_API" {
  if (!input.enabled || input.exactOwner) return "ALLOW";
  if (isMaintenanceFrontendPath(input.pathname)) return "MAINTENANCE_PAGE";
  if (isMaintenanceBlockedCustomerMutation(input)) return "MAINTENANCE_API";
  return "ALLOW";
}
