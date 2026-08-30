import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decideNexhqAuthRouting } from "@/lib/auth/routing";

const read = (path: string) => readFileSync(path, "utf8");
const enumMigration = read("supabase/migrations/20260830193000_xeriano_manual_credit_bucket_type_v1.sql");
const centerMigration = read("supabase/migrations/20260830194000_xeriano_owner_customer_center_v1.sql");
const service = read("lib/xeriano/owner-customer-center.ts");
const route = read("app/api/hq/customers/[accountId]/credits/route.ts");

const customerFacing = [
  "app/layout.tsx",
  "app/(public)/page.tsx",
  "app/(public)/pricing/page.tsx",
  "app/login/page.tsx",
  "app/register/page.tsx",
  "app/reset-password/page.tsx",
  "components/xeriano/public-header.tsx",
  "components/xeriano/public-footer.tsx",
  "components/xeriano/auth-shell.tsx",
  "components/xeriano/customer-providers.tsx",
  "components/navigation/studio-mobile-navigation.tsx",
  "components/xeriano/foundation-unavailable.tsx",
  "app/api/creative-studio/generate/route.ts",
  "app/api/ugc-video-studio/generate/route.ts",
  "app/api/xeriano/library/route.ts",
].map(read).join("\n");

test("public brand is Xeriamo while the internal technical namespace remains stable", () => {
  assert.match(customerFacing, /Xeriamo/);
  assert.doesNotMatch(customerFacing, /[\"'> ]Xeriano(?:[ .<\-]|$)/);
  assert.equal(read("lib/xeriano/config.ts").includes('"https://xeriamo.com"'), true);
  assert.match(read("app/api/xeriano/library/route.ts"), /\/api\/xeriano|xeriano_library_assets/);
  assert.match(read("supabase/migrations/20260828211000_xeriano_credits_v1.sql"), /xeriano_credit_buckets/);
});

test("manual credit migrations are additive, strict and non-commercial", () => {
  assert.match(enumMigration, /add value if not exists 'MANUAL'/i);
  assert.doesNotMatch(enumMigration + centerMigration, /\bdrop table\b|\btruncate\b|using\s*\(\s*true\s*\)/i);
  assert.match(centerMigration, /enable row level security/);
  assert.match(centerMigration, /revoke all on public\.xeriano_manual_credit_grants from public,anon,authenticated/);
  assert.match(centerMigration, /grant all on public\.xeriano_manual_credit_grants to service_role/);
  assert.match(centerMigration, /'commercialValueAuthority',false/);
  assert.doesNotMatch(centerMigration, /topup_product_version_id|gross_amount_minor|net_amount_minor/);
});

test("one OWNER manual grant creates one bucket, audit row and immutable ledger grant", () => {
  assert.match(centerMigration, /pg_advisory_xact_lock/);
  assert.match(centerMigration, /insert into public\.xeriano_credit_buckets/);
  assert.match(centerMigration, /'MANUAL',v_source_key,p_amount,p_amount,0,null/);
  assert.match(centerMigration, /insert into public\.xeriano_manual_credit_grants/);
  assert.match(centerMigration, /insert into public\.xeriano_credit_ledger/);
  assert.match(centerMigration, /'GRANT',p_amount,v_available/);
  assert.match(centerMigration, /before update or delete[\s\S]+xeriano_manual_credit_grants_immutable/);
  assert.doesNotMatch(service + route, /remaining_credits\s*[+:=-]|\.update\([^)]*remaining_credits/);
});

test("manual grant replay is database-idempotent and cannot become +1000", () => {
  assert.match(centerMigration, /where id=p_grant_id or idempotency_key=p_idempotency_key/);
  assert.match(centerMigration, /if found then[\s\S]+return jsonb_build_object\([\s\S]+'status','REPLAYED'/);
  assert.match(centerMigration, /source_key text not null unique/);
  assert.match(centerMigration, /idempotency_key text not null unique/);
  assert.match(centerMigration, /v_source_key\|\|':grant'/);
  assert.match(service, /p_idempotency_key: `owner-manual:\$\{input\.grantId\}`/);
  assert.match(route, /replayed: result\.status === "REPLAYED"/);
});

test("customer-center authority is exact OWNER and service-only", () => {
  assert.match(service, /hasXerianoOwnerAuthority\(access\.context\)/);
  assert.doesNotMatch(service, /role === "ADMIN"|\["OWNER",\s*"ADMIN"\]/);
  assert.match(centerMigration, /revoke all on function public\.xeriano_grant_manual_credits[\s\S]+from public,anon,authenticated/);
  assert.match(centerMigration, /grant execute on function public\.xeriano_grant_manual_credits[\s\S]+to service_role/);
  assert.match(route, /isTrustedXeriamoApplicationOrigin/);
  assert.deepEqual(
    decideNexhqAuthRouting({ pathname: "/api/hq/customers/11111111-1111-4111-8111-111111111111/credits", authenticated: true, internalOwner: false }),
    { kind: "api_forbidden", status: 403 },
  );
});

test("OWNER list is bounded, searchable and avoids per-customer application reads", () => {
  assert.match(centerMigration, /lower\(coalesce\(users\.email,''\)\) like lower\(trim\(p_search\)\) \|\| '%'/);
  assert.match(centerMigration, /profile\.display_name/);
  assert.doesNotMatch(centerMigration, /create\s+(?:unique\s+)?index[\s\S]{0,240}on\s+auth\.users/i);
  assert.doesNotMatch(centerMigration, /alter\s+table\s+auth\./i);
  assert.match(centerMigration, /xeriano_accounts\(created_at desc,id\)/);
  assert.match(centerMigration, /limit least\(greatest\(p_limit,1\),50\)/);
  assert.match(centerMigration, /count\(\*\) over\(\)/);
  assert.match(centerMigration, /left join lateral[\s\S]+xeriano_credit_buckets/);
  assert.match(service, /pageSize = Math\.min\(50/);
  assert.match(service, /\.limit\(30\)|\.limit\(20\)|\.limit\(12\)/);
});

test("manual credits are derived in wallets and stay outside paid revenue authority", () => {
  const wallet = read("lib/xeriano/server.ts");
  const creditsPage = read("app/(customer)/app/credits/page.tsx");
  assert.match(wallet, /MANUAL:0/);
  assert.match(wallet, /values\.SUBSCRIPTION\+values\.TOP_UP\+values\.TRIAL\+values\.MANUAL/);
  assert.match(wallet, /manualCredits:values\.MANUAL/);
  assert.match(creditsPage, /label: "Beta", value: summary\?\.manualCredits/);
  assert.match(creditsPage, /entry\.modelId \?\? "Xeriamo"/);
  assert.doesNotMatch(read("lib/xeriano/plans.ts") + read("lib/xeriano/pricing-engine.ts"), /MANUAL/);
});

test("OWNER navigation exposes Kunden without changing customer navigation", () => {
  const navigation = read("lib/i18n/data/hq-navigation.ts");
  assert.match(navigation, /id: "customers"[\s\S]+href: "\/hq\/customers"[\s\S]+label: "Kunden"/);
  const customerBlock = navigation.slice(navigation.indexOf("export function getCustomerSidebarSections"));
  assert.doesNotMatch(customerBlock, /\/hq\/customers/);
  assert.match(read("components/navigation/studio-mobile-navigation.tsx"), /const brand = "Xeriamo"/);
});
