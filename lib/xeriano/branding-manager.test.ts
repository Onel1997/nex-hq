import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createCanvas } from "canvas";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decideNexhqAuthRouting, isPublicBrandingPath } from "@/lib/auth/routing";
import { XeriamoBrandLockup } from "@/components/xeriano/brand-identity";
import { XeriamoBrandingProvider } from "@/components/xeriano/branding-provider";
import { XERIAMO_BRANDING_ROLES, type XeriamoPublicBrandAsset } from "./branding/contracts";
import { createXeriamoRootFaviconResponse, selectPublicBrandingCandidates } from "./branding/delivery";
import { resolveXeriamoBrowserBranding, retainResolvedBrandingSnapshot } from "./branding/presentation";
import { BRANDING_MAX_BYTES, BrandingValidationError, validateBrandingUpload } from "./branding/validation";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20260831141500_xeriano_branding_manager_v1.sql");

function png(width = 32, height = 32) {
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").fillRect(1, 1, 2, 2);
  return canvas.toBuffer("image/png");
}

function publicAsset(
  role: XeriamoPublicBrandAsset["role"],
  version: string,
  mimeType = "image/png",
): XeriamoPublicBrandAsset {
  return {
    role,
    version,
    mimeType,
    width: 512,
    height: 512,
    url: `/api/public/branding/${role.toLowerCase()}?v=${version}`,
  };
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
    "/api/public/branding/favicon-root",
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
  assert.match(identity, /showVisibleName = !markOnly && \(showName \|\| \(snapshot\.resolved && !asset\)\)/);
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
  assert.match(ownerCss, /\.hq-owner-mobile-brand-copy \.xeriamo-brand-identity\.is-logo \{[\s\S]*?height: 40\.8px;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-owner \.studio-mobile-branding-copy \.xeriamo-brand-identity\.is-logo \{[^}]*height: 40\.8px;/);
  assert.match(ownerCss, /\.xeriamo-brand-identity\.is-logo\.has-square-canvas img \{ object-fit: cover;/);
  assert.match(identity, /export function XeriamoBrandLockup/);
  assert.match(customer, /XeriamoBrandLockup/);
  assert.doesNotMatch(customer, /showName/);
  assert.match(productCss, /\.xeriamo-brand-lockup-mark\{[^}]*background:#000;[^}]*box-shadow:none/);
  assert.match(productCss, /\.xeriamo-brand-lockup-wordmark\{[^}]*width:clamp\(145px,40vw,184px\);[^}]*height:48px/);
  assert.doesNotMatch(productCss, /\.xeriano-auth-brand \.xeriamo-brand-identity\.is-logo\.is-fallback:before/);
});

test("server-hydrated branding renders active Icon + Logo without a fallback transition", () => {
  Object.assign(globalThis, { React });
  const active = {
    ICON: publicAsset("ICON", "icon-v1"),
    LOGO: publicAsset("LOGO", "logo-v1", "image/svg+xml"),
  };
  const activeMarkup = renderToStaticMarkup(React.createElement(
    XeriamoBrandingProvider,
    { initialSnapshot: { branding: active, resolved: true } },
    React.createElement(XeriamoBrandLockup),
  ));
  assert.match(activeMarkup, /\/api\/public\/branding\/icon/);
  assert.match(activeMarkup, /\/api\/public\/branding\/logo/);
  assert.doesNotMatch(activeMarkup, /<strong>Xeriamo<\/strong>/);
  assert.doesNotMatch(activeMarkup, /is-fallback/);

  const fallbackMarkup = renderToStaticMarkup(React.createElement(
    XeriamoBrandingProvider,
    { initialSnapshot: { branding: {}, resolved: true } },
    React.createElement(XeriamoBrandLockup),
  ));
  assert.match(fallbackMarkup, /xeriamo-brand-fallback-mark/);
  assert.match(fallbackMarkup, /<strong>Xeriamo<\/strong>/);

  const loadingMarkup = renderToStaticMarkup(React.createElement(
    XeriamoBrandingProvider,
    { initialSnapshot: { branding: {}, resolved: false } },
    React.createElement(XeriamoBrandLockup),
  ));
  assert.match(loadingMarkup, /is-loading/);
  assert.doesNotMatch(loadingMarkup, /<strong>Xeriamo<\/strong>/);
  assert.doesNotMatch(loadingMarkup, /xeriamo-brand-fallback-mark/);

  const current = { branding: active, resolved: true };
  assert.equal(retainResolvedBrandingSnapshot(current, { branding: {}, resolved: false }), current);
  assert.deepEqual(
    retainResolvedBrandingSnapshot(current, { branding: {}, resolved: true }),
    { branding: {}, resolved: true },
  );

  const provider = read("components/xeriano/branding-provider.tsx");
  assert.match(provider, /useState<XeriamoPublicBrandingSnapshot>\(initialSnapshot\)/);
  assert.doesNotMatch(provider, /useEffect\(\(\) => \{\s*void load\(\)/);
  assert.match(provider, /body\.resolved !== true/);
  assert.match(provider, /await Promise\.all\(changedIdentityUrls/);
  assert.match(provider, /image\.decode\(\)/);
  assert.match(provider, /retainResolvedBrandingSnapshot/);

  const rootLayout = read("app/layout.tsx");
  assert.equal((rootLayout.match(/<XeriamoBrandingProvider/g) ?? []).length, 1);
  assert.doesNotMatch(rootLayout, /<XeriamoBrandingProvider[^>]*\skey=/);
  assert.match(read("lib/xeriano/branding/server.ts"), /branding: lastResolvedPublicBranding \?\? \{\}, resolved: false/);
  assert.match(read("app\/api\/public\/branding\/route.ts"), /status: snapshot\.resolved \? 200 : 503/);
});

test("dynamic favicon authority is versioned, falls back to Icon and has no static App Router override", () => {
  const faviconV1 = resolveXeriamoBrowserBranding({
    FAVICON: publicAsset("FAVICON", "favicon-v1", "image/svg+xml"),
    ICON: publicAsset("ICON", "icon-v1"),
  });
  const faviconV2 = resolveXeriamoBrowserBranding({
    FAVICON: publicAsset("FAVICON", "favicon-v2", "image/svg+xml"),
    ICON: publicAsset("ICON", "icon-v1"),
  });
  assert.equal(faviconV1.favicon.url, "/api/public/branding/favicon?v=favicon-v1");
  assert.equal(faviconV1.favicon.sourceRole, "FAVICON");
  assert.notEqual(faviconV1.favicon.url, faviconV2.favicon.url);

  const iconFallback = resolveXeriamoBrowserBranding({ ICON: publicAsset("ICON", "icon-v7") });
  assert.equal(iconFallback.favicon.url, "/api/public/branding/favicon?v=icon-v7");
  assert.equal(iconFallback.favicon.sourceRole, "ICON");
  assert.equal(iconFallback.appleTouchIcon.sourceRole, "ICON");

  assert.equal(existsSync("app/favicon.ico"), false);
  assert.equal(existsSync("app/favicon.ico/route.ts"), false);
  assert.equal(existsSync("app/api/public/branding/favicon-root/route.ts"), true);
  assert.equal(existsSync("public/xeriamo-favicon-fallback.ico"), true);
  const layout = read("app/layout.tsx");
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /browserBranding\.favicon\.url/);
  assert.match(layout, /icon: \[\{ \.\.\.favicon, rel: "icon" \}\]/);
  assert.match(layout, /shortcut: \[\{ \.\.\.favicon, rel: "shortcut icon" \}\]/);
  assert.doesNotMatch(layout, /icon:\s*["']\/api\/public\/branding\/favicon["']/);
});

test("conventional root favicon returns authoritative bytes with Safari-safe cache policy", async () => {
  const favicon = { role: "FAVICON" as const, mime_type: "image/svg+xml", bytes: "favicon" };
  const icon = { role: "ICON" as const, mime_type: "image/png", bytes: "icon" };
  assert.deepEqual(
    selectPublicBrandingCandidates([icon, favicon], "FAVICON").map((candidate) => candidate.bytes),
    ["favicon", "icon"],
  );
  assert.deepEqual(
    selectPublicBrandingCandidates([icon], "FAVICON").map((candidate) => candidate.bytes),
    ["icon"],
  );
  assert.deepEqual(selectPublicBrandingCandidates([], "FAVICON"), []);

  const expected = new Uint8Array([0, 1, 2, 3, 254, 255]);
  const response = createXeriamoRootFaviconResponse({ bytes: expected, mimeType: "image/png" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);

  const route = read("app/api/public/branding/favicon-root/route.ts");
  assert.match(route, /loadPublicBrandingBytes\("FAVICON"\)/);
  assert.match(route, /createXeriamoRootFaviconResponse/);
  assert.doesNotMatch(route, /redirect/i);
  const nextConfig = read("next.config.ts");
  assert.match(
    nextConfig,
    /source:\s*["']\/favicon\.ico["'][\s\S]*destination:\s*["']\/api\/public\/branding\/favicon-root["']/,
  );
  const server = read("lib/xeriano/branding/server.ts");
  assert.match(server, /selectPublicBrandingCandidates\(rows, role\)/);
  assert.match(server, /role === "FAVICON" \? fallbackIcon\(\) : null/);

  const fallback = readFileSync("public/xeriamo-favicon-fallback.ico");
  assert.notEqual(
    createHash("sha256").update(fallback).digest("hex"),
    "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932",
    "the retired triangle favicon must never be the Xeriamo fallback",
  );
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
  const presentation = read("lib/xeriano/branding/presentation.ts");
  assert.match(layout, /resolveXeriamoBrowserBranding/);
  assert.match(presentation, /\/api\/public\/branding\/favicon/);
  assert.match(presentation, /\/api\/public\/branding\/apple-touch-icon/);
  assert.match(layout, /initialSnapshot=\{initialBranding\}/);
});

test("navigation lockups are reduced by 15 percent while Maintenance geometry stays unchanged", () => {
  const productCss = read("app/xeriano.css");
  assert.match(productCss, /\.xeriano-public-header \.xeriamo-brand-lockup-mark\{width:39\.1px;height:39\.1px;padding:4\.25px\}/);
  assert.match(productCss, /\.xeriano-public-header \.xeriamo-brand-lockup-wordmark\{width:clamp\(113\.9px,31\.45vw,144\.5px\);height:37\.4px\}/);
  assert.match(productCss, /\.xeriano-customer-mobile-header \.xeriamo-brand-lockup-mark\{width:42\.5px;height:42\.5px;padding:5\.1px\}/);
  assert.match(productCss, /\.xeriano-customer-mobile-header \.xeriamo-brand-lockup-wordmark\{width:clamp\(123\.25px,34vw,156\.4px\);height:40\.8px\}/);
  assert.match(productCss, /\.xeriano-maintenance-card \.xeriamo-brand-lockup-wordmark\{width:clamp\(150px,36vw,190px\)\}/);
  assert.match(productCss, /\.xeriano-maintenance-card \.xeriamo-brand-lockup-mark\{width:46px;height:46px\}/);
  const ownerCss = read("app/hq-navigation.css");
  assert.match(ownerCss, /\.hq-owner-mobile-brand > span:first-child \{[\s\S]*?width: 42\.5px;[\s\S]*?height: 42\.5px;/);
  assert.match(ownerCss, /\.hq-owner-mobile-brand-copy \.xeriamo-brand-identity\.is-logo \{[\s\S]*?width: clamp\(123\.25px, 34vw, 156\.4px\);[\s\S]*?height: 40\.8px;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-owner \.studio-mobile-branding > \.xeriamo-brand-identity \{[^}]*width: 42\.5px;[^}]*height: 42\.5px;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-customer \.studio-mobile-branding > \.xeriamo-brand-identity \{[^}]*width: 42\.5px;[^}]*height: 42\.5px;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-owner \.studio-mobile-branding-copy \.xeriamo-brand-identity\.is-logo \{[^}]*width: clamp\(112\.2px, 39\.1vw, 161\.5px\);[^}]*height: 40\.8px;/);
  assert.match(ownerCss, /\.studio-mobile-nav-drawer\.is-customer \.studio-mobile-branding-copy \.xeriamo-brand-identity\.is-logo \{[^}]*width: clamp\(112\.2px, 39\.1vw, 161\.5px\);[^}]*height: 40\.8px;/);
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
