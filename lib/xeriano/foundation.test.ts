import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { decideNexhqAuthRouting, isPublicNexhqPath } from "@/lib/auth/routing";
import { getXerianoAppUrl, XERIANO_DEFAULT_APP_URL } from "./config";
import {
  handoffHref,
  validateDesignSignature,
  xerianoResultLibraryImportSchema,
  XERIANO_DESIGN_MAX_BYTES,
  XERIANO_DESIGN_MIME_TYPES,
  XERIANO_LIBRARY_PAGE_SIZE,
} from "./library";
import {
  XERIANO_PLAN_REGISTRY,
  XERIANO_PLAN_VERSIONS,
  XERIANO_TOP_UPS,
  XERIANO_TRIAL,
} from "./plans";
import {
  isCustomerPricedModel,
  quoteXerianoCredits,
  XERIANO_CREDIT_PRICE_REGISTRY,
  XERIANO_CREDIT_PRICING_VERSION,
} from "./pricing";
import { isXerianoStripeConfigured, XERIANO_STRIPE_ENV } from "./stripe-config";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const readTree = (path: string): string => readdirSync(join(root, path)).map((name) => {
  if (name.endsWith(".test.ts")) return "";
  const child = join(path, name);
  return statSync(join(root, child)).isDirectory() ? readTree(child) : read(child);
}).join("\n");

test("V1 pricing is centralized, versioned and refuses undefined customer models", () => {
  assert.equal(XERIANO_CREDIT_PRICING_VERSION, "xeriano-generation-pricing-v2-economy");
  assert.equal(quoteXerianoCredits({ modelId: "nano-banana-pro", quality: "1K" }), 15);
  assert.equal(quoteXerianoCredits({ modelId: "nano-banana-pro", quality: "2K", count: 4 }), 60);
  assert.equal(quoteXerianoCredits({ modelId: "nano-banana-pro", quality: "4K", count: 2 }), 60);
  assert.equal(quoteXerianoCredits({ modelId: "kling-v3-pro-motion-control", durationSeconds: 5 }), 125);
  assert.throws(() => quoteXerianoCredits({ modelId: "kling-v3-pro-motion-control", durationSeconds: 0 }));
  assert.equal(isCustomerPricedModel("seedance-2.5"), false);
  assert.equal(Object.keys(XERIANO_CREDIT_PRICE_REGISTRY).length, 2);
});

test("monthly launch plans, top-ups and one-time trial match approved V1 policy", () => {
  assert.deepEqual(
    XERIANO_PLAN_VERSIONS.map((plan) => [plan.code, plan.grossPriceMinor / 100, plan.grantedCredits, plan.imageConcurrency, plan.videoConcurrency]),
    [["FREE", 0, 30, 1, 0], ["CREATOR", 19, 700, 1, 1], ["PRO", 39, 1_400, 2, 2], ["STUDIO", 69, 2_500, 2, 2], ["MAX", 119, 4_250, 4, 3]],
  );
  assert.equal(Object.values(XERIANO_PLAN_REGISTRY).every((plan) => plan.billingInterval === "NONE" || plan.billingInterval === "MONTHLY"), true);
  assert.deepEqual(XERIANO_TOP_UPS.map(({ credits, priceEur }) => [credits, priceEur]), [[250, 8], [500, 15], [1_000, 29], [2_500, 70]]);
  assert.deepEqual(XERIANO_TRIAL, { version: "xeriano-trial-v2", credits: 30, oneGrantPerAccount: true, commercialValueAuthority: false });
});

test("customer design signature validation only accepts approved image formats", () => {
  assert.deepEqual(XERIANO_DESIGN_MIME_TYPES, ["image/png", "image/jpeg", "image/webp"]);
  assert.equal(XERIANO_DESIGN_MAX_BYTES, 20 * 1024 * 1024);
  assert.equal(validateDesignSignature(Uint8Array.from([137,80,78,71,13,10,26,10]), "image/png"), true);
  assert.equal(validateDesignSignature(Uint8Array.from([0xff,0xd8,0xff]), "image/jpeg"), true);
  assert.equal(validateDesignSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"), true);
  assert.equal(validateDesignSignature(new TextEncoder().encode("<svg><script/></svg>"), "image/svg+xml"), false);
  assert.equal(XERIANO_LIBRARY_PAGE_SIZE, 24);
});

test("library handoffs open a target studio without auto-generation authority", () => {
  const id = "b56e9ad8-503c-4a1c-844c-ec7cb7fd12ef";
  assert.equal(handoffHref(id, "CREATIVE_STUDIO"), `/app/creative-studio?libraryAsset=${id}`);
  assert.equal(handoffHref(id, "UGC_VIDEO_STUDIO"), `/app/ugc-video-studio?libraryAsset=${id}`);
  assert.doesNotMatch(read("lib/xeriano/library.ts"), /from\s+["'][^"']*providers|\/api\/[^"']*generate/i);
  assert.equal(xerianoResultLibraryImportSchema.parse({
    version: "xeriano-result-library-import-v1",
    sourceStudio: "CREATIVE_STUDIO",
    sourceJobId: id,
    sourceResultId: "result-1",
    title: "Campaign Asset",
  }).sourceResultId, "result-1");
});

test("public and customer/internal routing is separated server-side", () => {
  for (const path of ["/", "/pricing", "/login", "/register", "/reset-password", "/impressum", "/datenschutz", "/terms"]) {
    assert.equal(isPublicNexhqPath(path), true, path);
  }
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/app/library", authenticated: true, internalOwner: false }), { kind: "allow" });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/hq", authenticated: true, internalOwner: false }), { kind: "redirect", location: "/app" });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/api/image/run", authenticated: true, internalOwner: false }), { kind: "api_forbidden", status: 403 });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/api/xeriano/library", authenticated: true, internalOwner: false }), { kind: "allow" });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/hq", authenticated: true, internalOwner: true }), { kind: "allow" });
});

test("four additive migrations define strict tenancy, atomic credits, billing and Library authority", () => {
  const migrations = [
    "supabase/migrations/20260828210000_xeriano_tenancy_v1.sql",
    "supabase/migrations/20260828211000_xeriano_credits_v1.sql",
    "supabase/migrations/20260828212000_xeriano_billing_v1.sql",
    "supabase/migrations/20260828213000_xeriano_library_v1.sql",
  ].map(read);
  assert.match(migrations[0], /xeriano_account_memberships/);
  assert.match(migrations[0], /enable row level security/);
  assert.match(migrations[1], /pg_advisory_xact_lock/);
  assert.match(migrations[1], /for update/);
  assert.match(migrations[1], /xeriano_reserve_credits/);
  assert.match(migrations[1], /xeriano_commit_credit_reservation/);
  assert.match(migrations[1], /xeriano_release_credit_reservation/);
  assert.match(migrations[1], /xeriano_refund_credit_reservation/);
  assert.match(migrations[2], /stripe_event_id text not null unique/);
  assert.match(migrations[3], /xeriano_library_assets/);
  assert.match(migrations[3], /public boolean not null default false|values\('xeriano-library-assets','xeriano-library-assets',false/);
  for (const migration of migrations) assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
});

test("credit tables are read-only to customers and credit functions are service-only", () => {
  const sql = read("supabase/migrations/20260828211000_xeriano_credits_v1.sql");
  assert.match(sql, /revoke all on public\.xeriano_subscription_state[\s\S]+from public,anon,authenticated/);
  assert.match(sql, /revoke all on function public\.xeriano_reserve_credits[\s\S]+from public,anon,authenticated/);
  assert.match(sql, /grant execute on function public\.xeriano_reserve_credits[\s\S]+to service_role/);
  assert.match(sql, /xeriano_credit_ledger_no_mutation/);
  assert.match(sql, /CREDIT_SETTLEMENT_IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]+xeriano_settle_credit_reservation|xeriano_settle_credit_reservation[\s\S]+pg_advisory_xact_lock/);
  assert.match(sql, /foreign key \(reservation_id, account_id, job_id, operation\)/);
  assert.match(sql, /order by \(expires_at is null\), expires_at/);
  assert.match(sql, /Cover accounts created after migration 1 but before this trigger existed/);
  for (const contract of [
    /plan = 'CREATOR'[\s\S]{0,120}monthly_credits = 800[\s\S]{0,120}image_concurrency_limit = 1[\s\S]{0,120}video_concurrency_limit = 1/,
    /plan = 'PRO'[\s\S]{0,120}monthly_credits = 2000[\s\S]{0,120}image_concurrency_limit = 2[\s\S]{0,120}video_concurrency_limit = 2/,
    /plan = 'MAX'[\s\S]{0,120}monthly_credits = 4000[\s\S]{0,120}image_concurrency_limit = 4[\s\S]{0,120}video_concurrency_limit = 3/,
  ]) assert.match(sql, contract);
});

test("customer authority cannot use an ADMIN or request-supplied workspace bypass", () => {
  const guard = read("lib/xeriano/credit-guard.ts");
  assert.match(guard, /context\.role === "OWNER"/);
  assert.doesNotMatch(guard, /context\.role === "ADMIN"|"OWNER" \| "ADMIN"/);
  for (const route of [
    "app/api/ugc-video-studio/assets/[jobId]/[resultId]/route.ts",
    "app/api/ugc-video-studio/jobs/[jobId]/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /resolveXerianoAccess/);
    assert.match(source, /workspaceId: access\.context\.workspaceKey/);
    assert.match(source, /actorId: access\.context\.userId/);
    assert.doesNotMatch(source, /getActiveWorkspaceSlug|searchParams.*workspace|formData.*workspace/);
  }
  const creativeAsset = read("app/api/creative-studio/assets/[jobId]/[resultId]/route.ts");
  const creativeHistory = read("lib/creative-studio/account-history.ts");
  assert.match(creativeAsset, /resolveXerianoAccess/);
  assert.match(creativeAsset, /resolveCreativeAccountJobScope/);
  assert.match(creativeHistory, /accountId: input\.context\.accountId/);
  assert.match(creativeHistory, /workspaceId: input\.context\.workspaceKey/);
  assert.doesNotMatch(creativeAsset, /getActiveWorkspaceSlug|searchParams.*workspace|formData.*workspace/);
});

test("explicit owner allowlist replaces rather than unions the legacy Persona fallback", () => {
  for (const path of ["lib/xeriano/auth.ts", "lib/supabase/middleware.ts"]) {
    const source = read(path);
    assert.match(source, /explicitOwnerIds\.length/);
    assert.doesNotMatch(source, /\.\.\.parsePersonaAuthorizedUserIds\(.*NEXHQ_OWNER_USER_IDS[\s\S]{0,160}\.\.\.parsePersonaAuthorizedUserIds\(.*NEXHQ_PERSONA_AUTHORIZED_USER_IDS/);
  }
});

test("expired buckets are excluded from displayed customer credit availability", () => {
  const source = read("lib/xeriano/server.ts");
  assert.match(source, /expires_at/);
  assert.match(source, /Date\.parse\(row\.expires_at\) <= now/);
});

test("Library schema binds asset links and storage paths to one account", () => {
  const sql = read("supabase/migrations/20260828213000_xeriano_library_v1.sql");
  assert.match(sql, /foreign key \(asset_id,account_id\)[\s\S]+references public\.xeriano_library_assets\(id,account_id\)/);
  assert.match(sql, /storage_path like 'accounts\/' \|\| account_id::text/);
  assert.match(sql, /as restrictive for all to anon, authenticated/);
  assert.match(sql, /on conflict\(id\) do update set[\s\S]+public = false/);
});

test("customer Design Studio is separate from internal Design runtime", () => {
  const source = read("components/xeriano/customer-design-studio.tsx") + read("app/api/xeriano/library/route.ts");
  assert.match(source, /Design hochladen/);
  assert.match(source, /Im Creative Studio verwenden/);
  assert.doesNotMatch(source, /\/api\/image\/run|\/api\/design\/|master-artwork|Persona|Research|Commerce/);
});

test("customer wrappers reuse studio workspaces without importing provider adapters", () => {
  const creativePage = read("app/(customer)/app/creative-studio/page.tsx");
  const ugcPage = read("app/(customer)/app/ugc-video-studio/page.tsx");
  assert.match(creativePage, /CreativeStudioWorkspace/);
  assert.match(creativePage, /customerMode/);
  assert.match(ugcPage, /UgcVideoStudioWorkspace/);
  assert.match(ugcPage, /customerMode/);
  const xerianoSources = ["lib/xeriano", "components/xeriano", "app/api/xeriano"].map(readTree).join("\n");
  assert.doesNotMatch(xerianoSources, /creative-studio\/providers|ugc-video-studio\/providers|\/api\/image\/run/);
});

test("Stripe remains server-configured and no public secret or price ID is hard-coded", () => {
  assert.equal(isXerianoStripeConfigured({}), false);
  assert.equal(isXerianoStripeConfigured({ STRIPE_SECRET_KEY: "x", STRIPE_WEBHOOK_SECRET: "y" }), false);
  assert.equal(isXerianoStripeConfigured({
    STRIPE_SECRET_KEY: "sk_test_not_real",
    STRIPE_WEBHOOK_SECRET: "whsec_not_real",
    NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co",
    NEXT_PUBLIC_APP_URL: "https://staging.xeriamo.com",
  }), true);
  assert.equal(XERIANO_STRIPE_ENV.secretKey, "STRIPE_SECRET_KEY");
  assert.equal(XERIANO_STRIPE_ENV.webhookSecret, "STRIPE_WEBHOOK_SECRET");
  assert.equal(getXerianoAppUrl({}), XERIANO_DEFAULT_APP_URL);
  assert.equal(getXerianoAppUrl({ NEXT_PUBLIC_APP_URL: "https://www.xeriamo.com/path" }), "https://www.xeriamo.com");
  const webhook = read("app/api/xeriano/billing/webhook/route.ts");
  assert.match(webhook, /XERIANO_STRIPE_WEBHOOK_MAX_BYTES/);
  assert.match(webhook, /Buffer\.byteLength/);
  assert.ok(webhook.indexOf("verifyXerianoStripeEvent") < webhook.indexOf("isSupportedXerianoStripeEvent(event.type)"));
});

test("public app metadata, private noindex and legal placeholders exist", () => {
  assert.match(read("app/layout.tsx"), /Xeriamo/);
  assert.match(read("app/robots.ts"), /\/app\//);
  assert.match(read("app/robots.ts"), /\/hq\//);
  assert.match(read("app/sitemap.ts"), /\/pricing/);
  for (const page of ["impressum", "datenschutz", "terms"]) {
    assert.match(read(`app/(public)/${page}/page.tsx`), /rechtlich|Rechtsberatung|Owner|Prüfung/i);
  }
});

test("registration checks Xeriano tenancy readiness before creating an auth user", () => {
  const source = read("app/register/actions.ts");
  assert.ok(source.indexOf('from("xeriano_accounts")') < source.indexOf("auth.signUp"));
  for (const table of ["xeriano_credit_accounts", "xeriano_billing_customers", "xeriano_library_assets"]) {
    assert.ok(source.indexOf(`from("${table}")`) < source.indexOf("auth.signUp"), table);
  }
  assert.match(source, /Es wurde kein Konto erstellt/);
});
