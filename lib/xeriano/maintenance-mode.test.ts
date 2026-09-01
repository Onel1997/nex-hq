import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decideNexhqAuthRouting, isPublicNexhqPath } from "@/lib/auth/routing";
import {
  isMaintenanceBlockedCustomerMutation,
  isMaintenanceFrontendPath,
  maintenanceDecision,
  maintenanceReturnPath,
} from "./maintenance/routing";
import {
  clearEdgeMaintenanceStatusCacheForTests,
  loadEdgeMaintenanceStatus,
} from "./maintenance/edge-status";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20260901095309_xeriano_maintenance_mode_v1.sql");

test("ONLINE preserves every public and customer frontend route", () => {
  for (const pathname of ["/", "/pricing", "/login", "/register", "/reset-password", "/app", "/app/design-studio"]) {
    assert.equal(isMaintenanceFrontendPath(pathname), true, pathname);
    assert.equal(maintenanceDecision({ enabled: false, pathname, method: "GET", exactOwner: false }), "ALLOW", pathname);
  }
});

test("MAINTENANCE gates anonymous/customer frontend but exact OWNER bypasses it", () => {
  for (const pathname of ["/", "/pricing", "/login", "/register", "/reset-password", "/app", "/app/library"]) {
    assert.equal(maintenanceDecision({ enabled: true, pathname, method: "GET", exactOwner: false }), "MAINTENANCE_PAGE", pathname);
    assert.equal(maintenanceDecision({ enabled: true, pathname, method: "GET", exactOwner: true }), "ALLOW", pathname);
  }
  assert.equal(maintenanceDecision({ enabled: true, pathname: "/hq", method: "GET", exactOwner: true }), "ALLOW");
  assert.equal(maintenanceDecision({ enabled: true, pathname: "/hq", method: "GET", exactOwner: false }), "ALLOW");
});

test("MAINTENANCE keeps legal information routes normally accessible", () => {
  for (const pathname of ["/impressum", "/datenschutz", "/terms"]) {
    assert.equal(isMaintenanceFrontendPath(pathname), false, pathname);
    assert.equal(
      maintenanceDecision({ enabled: true, pathname, method: "GET", exactOwner: false }),
      "ALLOW",
      pathname,
    );
  }
});

test("new customer product mutations fail at the gate while recovery infrastructure remains live", () => {
  for (const [method, pathname] of [
    ["POST", "/api/creative-studio/generate"],
    ["POST", "/api/design-studio/generate"],
    ["POST", "/api/design-studio/utility"],
    ["POST", "/api/design-studio/svg-to-png"],
    ["POST", "/api/ugc-video-studio/generate"],
    ["POST", "/api/xeriano/temp-references"],
    ["POST", "/api/xeriano/library"],
    ["POST", "/api/xeriano/billing/checkout"],
    ["PATCH", "/api/xeriano/library/11111111-1111-4111-8111-111111111111"],
  ]) {
    assert.equal(isMaintenanceBlockedCustomerMutation({ method, pathname }), true, pathname);
    assert.equal(maintenanceDecision({ enabled: true, method, pathname, exactOwner: false }), "MAINTENANCE_API", pathname);
    assert.equal(maintenanceDecision({ enabled: true, method, pathname, exactOwner: true }), "ALLOW", pathname);
  }

  for (const [method, pathname] of [
    ["GET", "/api/creative-studio/jobs/job-id"],
    ["GET", "/api/design-studio/jobs/job-id"],
    ["GET", "/api/ugc-video-studio/jobs/job-id"],
    ["PUT", "/api/creative-studio/jobs/job-id/reference-snapshot"],
    ["POST", "/api/xeriano/temp-references/11111111-1111-4111-8111-111111111111/complete"],
    ["DELETE", "/api/xeriano/temp-references/11111111-1111-4111-8111-111111111111"],
    ["POST", "/api/xeriano/billing/webhook"],
    ["GET", "/api/public/branding/logo"],
    ["GET", "/api/public/maintenance"],
  ]) {
    assert.equal(isMaintenanceBlockedCustomerMutation({ method, pathname }), false, pathname);
  }
});

test("maintenance return paths stay local and bounded", () => {
  assert.equal(maintenanceReturnPath("/app/design-studio", "?tab=history"), "/app/design-studio?tab=history");
  assert.equal(maintenanceReturnPath("/hq", ""), "/");
  assert.equal(maintenanceReturnPath("/app", `?x=${"a".repeat(1_100)}`), "/");
});

test("Edge status read is short-cached and fail-sticky after observing Maintenance", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-test-key";
  clearEdgeMaintenanceStatusCacheForTests();
  try {
    globalThis.fetch = async () => new Response(JSON.stringify([{
      maintenance_enabled: true,
      maintenance_message: "Kurzer Test",
      maintenance_expected_back_at: null,
      maintenance_discord_enabled: false,
      updated_at: "2026-09-01T10:00:00.000Z",
    }]), { status: 200, headers: { "content-type": "application/json" } });
    assert.equal((await loadEdgeMaintenanceStatus({ fresh: true })).state, "MAINTENANCE");
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal((await loadEdgeMaintenanceStatus({ fresh: true })).state, "MAINTENANCE");
  } finally {
    globalThis.fetch = previousFetch;
    clearEdgeMaintenanceStatusCacheForTests();
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("maintenance and dedicated OWNER login routes remain sessionless while /hq stays protected", () => {
  for (const pathname of ["/maintenance", "/api/public/maintenance", "/hq/login"]) {
    assert.equal(isPublicNexhqPath(pathname), true, pathname);
    assert.deepEqual(decideNexhqAuthRouting({ pathname, authenticated: false }), { kind: "allow" }, pathname);
  }
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/hq", authenticated: false }), { kind: "redirect", location: "/hq/login" });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/hq", authenticated: true, internalOwner: false }), { kind: "redirect", location: "/app" });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/hq", authenticated: true, internalOwner: true }), { kind: "allow" });
});

test("migration provides one global row, atomic audit and least-privilege authority", () => {
  assert.match(migration, /id text primary key check \(id = 'XERIAMO'\)/);
  assert.match(migration, /maintenance_enabled boolean not null default false/);
  assert.match(migration, /xeriano_system_status_events/);
  assert.match(migration, /previous_state text not null[\s\S]*next_state text not null/);
  assert.match(migration, /actor_user_id uuid not null references auth\.users/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on public\.xeriano_system_status,public\.xeriano_system_status_events[\s\S]*from public,anon,authenticated/i);
  assert.match(migration, /grant execute on function public\.xeriano_get_public_maintenance_status\(\)[\s\S]*to anon,authenticated,service_role/i);
  assert.match(migration, /grant execute on function public\.xeriano_set_maintenance_status[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.xeriano_set_maintenance_status[\s\S]*to (?:anon|authenticated)/i);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
});

test("exact OWNER authority and same-origin protection guard status writes", () => {
  const server = read("lib/xeriano/maintenance/server.ts");
  const route = read("app/api/hq/maintenance/route.ts");
  assert.match(server, /hasXerianoOwnerAuthority/);
  assert.match(server, /assessTrustedXeriamoApplicationOrigin/);
  assert.match(server, /p_actor_user_id: owner\.userId/);
  assert.doesNotMatch(server, /role\s*===\s*["']ADMIN/);
  assert.match(route, /updateXeriamoMaintenanceSchema/);
  assert.match(route, /Keine Berechtigung für diese Aktion\./);
  assert.doesNotMatch(`${server}\n${route}`, /FAL_KEY|STRIPE_SECRET|reserveCustomerGeneration|queue\.submit/);
});

test("OWNER re-login reuses Supabase auth and signs out non-OWNER actors", () => {
  const action = read("app/hq/login/actions.ts");
  const page = read("app/hq/login/page.tsx");
  assert.match(action, /signInWithPassword/);
  assert.match(action, /hasXerianoOwnerAuthority/);
  assert.match(action, /endNexhqSession/);
  assert.match(action, /redirect\("\/hq"\)/);
  assert.match(page, /LoginForm/);
  assert.match(page, /loginMaintenanceOwner/);
  assert.doesNotMatch(action, /role\s*===\s*["']ADMIN/);
});

test("maintenance page is dynamically branded and status check never auto-submits work", () => {
  const page = read("app/maintenance/page.tsx");
  const check = read("app/maintenance/status-check.tsx");
  const manager = read("components/settings/maintenance-manager.tsx");
  assert.match(page, /XeriamoBrandLockup/);
  assert.match(page, /Wir sind gleich wieder da\./);
  assert.match(page, /status\.message/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(check, /\/api\/public\/maintenance/);
  assert.match(check, /maintenance_recheck/);
  assert.match(manager, /Wartungsmodus wirklich aktivieren\?/);
  assert.match(manager, /laufende Hintergrundprozesse bleiben weiterhin aktiv/);
  assert.doesNotMatch(`${page}\n${check}\n${manager}`, /queue\.submit|reserveCustomerGeneration|@fal-ai|stripe/i);
});

test("middleware materializes a safe 503 before customer product routes", () => {
  const middleware = read("lib/supabase/middleware.ts");
  assert.match(middleware, /code: "MAINTENANCE_MODE"/);
  assert.match(middleware, /status: 503/);
  assert.match(middleware, /Retry-After/);
  assert.match(middleware, /maintenanceDecision/);
  assert.match(middleware, /ownerResolutionRequiredForMaintenance/);
  assert.doesNotMatch(middleware, /Access-Control-Allow-Origin/);
});
