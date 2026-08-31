import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCanvas } from "canvas";
import { decideNexhqAuthRouting, isPublicBrandingPath } from "@/lib/auth/routing";
import { XERIAMO_BRANDING_ROLES } from "./branding/contracts";
import { BRANDING_MAX_BYTES, BrandingValidationError, validateBrandingUpload } from "./branding/validation";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20260831141500_xeriano_branding_manager_v1.sql");

function png(width = 32, height = 32) {
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").fillRect(1, 1, 2, 2);
  return canvas.toBuffer("image/png");
}

test("Branding V1 has exactly four bounded roles and validates actual bytes", async () => {
  assert.deepEqual(XERIAMO_BRANDING_ROLES, ["LOGO", "ICON", "FAVICON", "APPLE_TOUCH_ICON"]);
  const valid = await validateBrandingUpload({ role: "ICON", bytes: png(), declaredMimeType: "image/png", originalFilename: "icon.png" });
  assert.deepEqual({ mimeType: valid.mimeType, width: valid.width, height: valid.height }, { mimeType: "image/png", width: 32, height: 32 });
  await assert.rejects(
    validateBrandingUpload({ role: "APPLE_TOUCH_ICON", bytes: Buffer.from("not-an-image"), declaredMimeType: "image/png", originalFilename: "fake.png" }),
    (error: unknown) => error instanceof BrandingValidationError && error.code === "INVALID_FILE",
  );
  await assert.rejects(
    validateBrandingUpload({ role: "FAVICON", bytes: Buffer.alloc(BRANDING_MAX_BYTES.FAVICON + 1), declaredMimeType: "image/png", originalFilename: "large.png" }),
    (error: unknown) => error instanceof BrandingValidationError && error.code === "FILE_TOO_LARGE",
  );
});

test("Branding SVG validation reuses the hardened Xeriamo SVG authority", async () => {
  const safe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><path d="M0 0h10v10z"/></svg>');
  const valid = await validateBrandingUpload({ role: "LOGO", bytes: safe, declaredMimeType: "image/svg+xml", originalFilename: "logo.svg" });
  assert.equal(valid.mimeType, "image/svg+xml");
  assert.deepEqual([valid.width, valid.height], [200, 100]);
  for (const unsafe of [
    '<svg><script>alert(1)</script></svg>',
    '<svg><image href="https://evil.invalid/a.png"/></svg>',
    '<svg onload="alert(1)"></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>',
  ]) {
    await assert.rejects(
      validateBrandingUpload({ role: "LOGO", bytes: Buffer.from(unsafe), declaredMimeType: "image/svg+xml", originalFilename: "unsafe.svg" }),
      (error: unknown) => error instanceof BrandingValidationError && (error.code === "UNSAFE_SVG" || error.code === "INVALID_FILE"),
    );
  }
  assert.match(read("lib/xeriano/branding/validation.ts"), /isSafePrivateSvg/);
});

test("migration creates private version history and atomic one-active-per-role authority", () => {
  for (const role of XERIAMO_BRANDING_ROLES) assert.match(migration, new RegExp(`'${role}'`));
  assert.match(migration, /xeriano_branding_one_active_role_idx[\s\S]*where active and deleted_at is null/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /BRANDING_ACTIVE_ASSET/);
  assert.match(migration, /'UPLOADED','ACTIVATED','DELETED'/);
  assert.match(migration, /'xeriamo-branding'[\s\S]*false/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all[\s\S]*from public,anon,authenticated/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
});

test("public branding reads are sessionless while every mutation remains exact-Owner", () => {
  for (const path of [
    "/api/public/branding",
    "/api/public/branding/logo",
    "/api/public/branding/icon",
    "/api/public/branding/favicon",
    "/api/public/branding/apple-touch-icon",
  ]) {
    assert.equal(isPublicBrandingPath(path), true);
    assert.deepEqual(decideNexhqAuthRouting({ pathname: path, authenticated: false }), { kind: "allow" });
  }
  assert.equal(isPublicBrandingPath("/api/public/branding/logo/extra"), false);
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/api/hq/branding", authenticated: true, internalOwner: false }), { kind: "api_forbidden", status: 403 });
  assert.deepEqual(decideNexhqAuthRouting({ pathname: "/api/hq/branding", authenticated: true, internalOwner: true }), { kind: "allow" });
  const server = read("lib/xeriano/branding/server.ts");
  assert.match(server, /hasXerianoOwnerAuthority/);
  const auth = read("lib/xeriano/auth.ts");
  assert.match(auth, /\.eq\("role", "OWNER"\)/);
  assert.match(auth, /internalOwner: activeOwnerMembership/);
  assert.match(server, /createAdminClient/);
  assert.doesNotMatch(server, /role\s*===\s*["']ADMIN/);
});

test("active Icon + Logo lockups are consistent while Owner presentation remains stable", () => {
  const identity = read("components/xeriano/brand-identity.tsx");
  const header = read("components/layout/dashboard-shell.tsx");
  const sidebar = read("components/navigation/hq-sidebar.tsx");
  const drawer = read("components/navigation/studio-mobile-navigation.tsx");
  const customer = read("components/xeriano/customer-nav.tsx");
  const ownerCss = read("app/hq-navigation.css");
  const productCss = read("app/xeriano.css");
  assert.match(identity, /showVisibleName = !markOnly && \(showName \|\| !asset\)/);
  assert.match(identity, /showVisibleName \? <strong>Xeriamo<\/strong> : markOnly \? null/);
  assert.match(identity, /hasSquareLogoCanvas/);
  assert.match(header, /role="ICON" markOnly/);
  assert.match(header, /className="hq-owner-mobile-brand-copy">\s*<XeriamoBrandIdentity role="LOGO" \/>/);
  assert.doesNotMatch(header, /<strong>Xeriamo<\/strong>/);
  assert.doesNotMatch(header, /Owner Workspace/i);
  assert.match(sidebar, /role="ICON" markOnly/);
  assert.match(sidebar, /hq-sidebar-logo-text"><XeriamoBrandIdentity role="LOGO" \/>/);
  assert.match(drawer, /<XeriamoBrandIdentity role="ICON" markOnly \/>/);
  assert.match(drawer, /<XeriamoBrandIdentity role="LOGO" \/>/);
  assert.doesNotMatch(drawer, /Owner Workspace/i);
  assert.doesNotMatch(drawer, /Creator Suite/i);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-owner \.studio-mobile-branding > \.xeriamo-brand-identity \{[^}]*background: #000;[^}]*box-shadow: none;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-customer \.studio-mobile-branding > \.xeriamo-brand-identity \{[^}]*background: #000;[^}]*box-shadow: none;/);
  assert.match(ownerCss, /\.hq-owner-mobile-brand > span:first-child \{[\s\S]*?background: #000;[\s\S]*?box-shadow: none;/);
  assert.match(ownerCss, /\.hq-owner-mobile-brand-copy \.xeriamo-brand-identity\.is-logo \{[\s\S]*?height: 48px;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-owner \.studio-mobile-branding-copy \.xeriamo-brand-identity\.is-logo \{[^}]*height: 48px;/);
  assert.match(ownerCss, /\.xeriamo-brand-identity\.is-logo\.has-square-canvas img \{ object-fit: cover;/);
  assert.match(identity, /export function XeriamoBrandLockup/);
  assert.match(customer, /XeriamoBrandLockup/);
  assert.doesNotMatch(customer, /showName/);
  assert.match(productCss, /\.xeriamo-brand-lockup-mark\{[^}]*background:#000;[^}]*box-shadow:none/);
  assert.match(productCss, /\.xeriamo-brand-lockup-wordmark\{[^}]*width:clamp\(145px,40vw,184px\);[^}]*height:48px/);
  assert.doesNotMatch(productCss, /\.xeriano-auth-brand \.xeriamo-brand-identity\.is-logo\.is-fallback:before/);
});

test("uploads are server-owned, path-safe and do not auto-activate", () => {
  const server = read("lib/xeriano/branding/server.ts");
  const route = read("app/api/hq/branding/route.ts");
  assert.match(server, /branding\/\$\{input\.role\.toLowerCase\(\)\}\/\$\{assetId\}\/\$\{randomUUID\(\)\}/);
  assert.match(server, /validateBrandingUpload/);
  assert.match(route, /requireXeriamoBrandingMutationRequest/);
  assert.doesNotMatch(server, /NEXT_PUBLIC_.*(?:SERVICE|KEY)|FAL_KEY|@fal-ai|fal-ai\/|STRIPE_SECRET/i);
  assert.doesNotMatch(server, /active:\s*true|p_active/);
});

test("every Branding mutation shares exact-Owner and same-application request authority", () => {
  const server = read("lib/xeriano/branding/server.ts");
  const routes = [
    read("app/api/hq/branding/route.ts"),
    read("app/api/hq/branding/[assetId]/activate/route.ts"),
    read("app/api/hq/branding/[assetId]/route.ts"),
  ];
  assert.match(server, /requireXeriamoBrandingMutationRequest/);
  assert.match(server, /requireXeriamoBrandingOwner/);
  assert.match(server, /assessTrustedXeriamoApplicationOrigin/);
  assert.match(server, /MUTATION_ORIGIN_REQUIRED/);
  for (const route of routes) assert.match(route, /requireXeriamoBrandingMutationRequest/);
  for (const route of routes) assert.match(route, /Keine Berechtigung für diese Aktion\./);
});

test("public delivery is ETag-revalidated, content-sniff safe and metadata-minimal", () => {
  const publicRoute = read("app/api/public/branding/[role]/route.ts");
  const configRoute = read("app/api/public/branding/route.ts");
  const contracts = read("lib/xeriano/branding/contracts.ts");
  assert.match(publicRoute, /If-None-Match|if-none-match/i);
  assert.match(publicRoute, /max-age=0, must-revalidate/);
  assert.match(publicRoute, /X-Content-Type-Options/);
  assert.match(configRoute, /loadPublicBranding/);
  assert.doesNotMatch(contracts, /storagePath|createdBy|uploader|accountId/);
});

test("runtime identity uses fallbacks and covers public, auth, customer and Owner surfaces", () => {
  const provider = read("components/xeriano/branding-provider.tsx");
  const identity = read("components/xeriano/brand-identity.tsx");
  assert.match(provider, /\/api\/public\/branding/);
  assert.match(provider, /apple-touch-icon/);
  assert.match(identity, /is-fallback/);
  for (const file of [
    "components/xeriano/public-header.tsx",
    "components/xeriano/auth-shell.tsx",
    "components/xeriano/customer-nav.tsx",
  ]) assert.match(read(file), /XeriamoBrandLockup/, file);
  for (const file of [
    "components/layout/dashboard-shell.tsx",
    "components/navigation/hq-sidebar.tsx",
  ]) assert.match(read(file), /XeriamoBrandIdentity/, file);
  const layout = read("app/layout.tsx");
  assert.match(layout, /\/api\/public\/branding\/favicon/);
  assert.match(layout, /\/api\/public\/branding\/apple-touch-icon/);
});

test("Owner Branding Manager exposes four roles, preview, explicit activation and inactive-only delete", () => {
  const manager = read("components/settings/branding-manager.tsx");
  for (const label of ["Logo", "Icon", "Favicon", "Apple Touch Icon", "Als aktiv setzen", "Branding aktualisiert"]) assert.match(manager, new RegExp(label));
  assert.match(manager, /if \(asset\.active/);
  assert.match(manager, /is-dark/);
  assert.match(manager, /is-light/);
  assert.match(manager, /owner-branding-browser-preview/);
  assert.doesNotMatch(manager, /auto.*activ/i);
});
