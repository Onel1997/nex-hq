import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveValidatedNexhqActor } from "@/lib/auth/authentication";
import {
  decideNexhqAuthRouting,
  isCustomerProductApiPath,
  isSessionlessStripeWebhookPath,
} from "@/lib/auth/routing";
import {
  clearVerifiedIdentityHeaders,
  NEXHQ_VERIFIED_USER_EMAIL_HEADER,
  NEXHQ_VERIFIED_USER_ID_HEADER,
} from "@/lib/auth/verified-request";
import { parsePersonaAuthorizedUserIds } from "@/lib/persona/security/authorization";
import { loadEdgeMaintenanceStatus } from "@/lib/xeriano/maintenance/edge-status";
import {
  isMaintenanceBlockedCustomerMutation,
  isMaintenanceFrontendPath,
  maintenanceDecision,
  maintenanceReturnPath,
} from "@/lib/xeriano/maintenance/routing";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
  return target;
}

export async function updateSession(request: NextRequest) {
  // Stripe has no Supabase browser session. This one exact endpoint is secured
  // by raw-body signature verification and TEST/livemode guards in its route.
  // Bypass session refresh entirely so middleware cannot consume or transform
  // the signed request before verification.
  if (isSessionlessStripeWebhookPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const maintenanceCandidate =
    isMaintenanceFrontendPath(pathname) ||
    isMaintenanceBlockedCustomerMutation({ pathname, method: request.method });
  const maintenanceStatusPromise = maintenanceCandidate
    ? loadEdgeMaintenanceStatus({ fresh: request.nextUrl.searchParams.has("maintenance_recheck") })
    : null;

  const requestHeaders = new Headers(request.headers);
  clearVerifiedIdentityHeaders(requestHeaders);
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let authenticated = false;
  let authenticatedUserId: string | null = null;
  let internalOwner = false;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const authentication = await resolveValidatedNexhqActor(() =>
      supabase.auth.getUser(),
    );
    authenticated = authentication.authenticated;
    if (authentication.authenticated) {
      authenticatedUserId = authentication.actor.userId;
      const explicitOwnerIds = parsePersonaAuthorizedUserIds(process.env.NEXHQ_OWNER_USER_IDS);
      const compatibilityOwnerIds = explicitOwnerIds.length
        ? explicitOwnerIds
        : parsePersonaAuthorizedUserIds(process.env.NEXHQ_PERSONA_AUTHORIZED_USER_IDS);
      internalOwner = [...new Set(compatibilityOwnerIds)].includes(authentication.actor.userId);
      const customerBoundary = pathname === "/app" || pathname.startsWith("/app/") ||
        isCustomerProductApiPath(pathname);
      const maintenanceStatus = maintenanceStatusPromise
        ? await maintenanceStatusPromise
        : null;
      const ownerResolutionRequiredForMaintenance =
        maintenanceCandidate && maintenanceStatus?.state === "MAINTENANCE";
      if (!internalOwner && (!customerBoundary || ownerResolutionRequiredForMaintenance)) {
        // The additive Xeriano membership is the future role authority. Until
        // rollout, a missing table fails closed and legacy owner IDs stay valid.
        const membership = await supabase
          .from("xeriano_account_memberships")
          .select("role,status")
          .eq("user_id", authentication.actor.userId)
          .eq("role", "OWNER")
          .eq("status", "ACTIVE")
          .limit(1)
          .maybeSingle();
        internalOwner = !membership.error && Boolean(membership.data);
      }
      requestHeaders.set(
        NEXHQ_VERIFIED_USER_ID_HEADER,
        authentication.actor.userId,
      );
      if (authentication.actor.email) {
        requestHeaders.set(
          NEXHQ_VERIFIED_USER_EMAIL_HEADER,
          authentication.actor.email,
        );
      }
      supabaseResponse = copyResponseCookies(
        supabaseResponse,
        NextResponse.next({ request: { headers: requestHeaders } }),
      );
    }
  }

  const maintenanceStatus = maintenanceStatusPromise
    ? await maintenanceStatusPromise
    : null;
  const gate = maintenanceDecision({
    enabled: maintenanceStatus?.state === "MAINTENANCE",
    pathname,
    method: request.method,
    exactOwner: internalOwner,
  });

  if (gate === "MAINTENANCE_API") {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.json(
        {
          success: false,
          code: "MAINTENANCE_MODE",
          error: "Xeriamo wird gerade gewartet. Bitte versuche es in Kürze erneut.",
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "120",
          },
        },
      ),
    );
  }

  if (gate === "MAINTENANCE_PAGE") {
    const maintenanceUrl = new URL("/maintenance", request.url);
    maintenanceUrl.searchParams.set(
      "returnTo",
      maintenanceReturnPath(pathname, request.nextUrl.search),
    );
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(maintenanceUrl),
    );
  }

  const decision = decideNexhqAuthRouting({
    pathname,
    authenticated,
    internalOwner: authenticatedUserId ? internalOwner : false,
  });

  if (decision.kind === "api_unauthorized") {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.json(
        {
          error: "Authentication is required.",
          code: "AUTHENTICATION_REQUIRED",
        },
        {
          status: decision.status,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    );
  }

  if (decision.kind === "api_forbidden") {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.json(
        { error: "Dieser interne NexHQ-Bereich ist für Kunden nicht freigegeben.", code: "INTERNAL_ACCESS_FORBIDDEN" },
        { status: decision.status, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  if (decision.kind === "redirect") {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(decision.location, request.url)),
    );
  }

  return supabaseResponse;
}
