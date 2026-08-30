import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  getStudioSidebarSections,
  isSidebarNavItemActive,
} from "@/lib/navigation/hq-navigation";

test("one canonical navigation authority projects only customer-authorized routes", () => {
  const owner = getStudioSidebarSections("de", "OWNER").flatMap((section) => section.items);
  const customer = getStudioSidebarSections("de", "CUSTOMER").flatMap((section) => section.items);
  assert.ok(owner.some((item) => item.id === "ceo"));
  assert.ok(owner.some((item) => item.id === "shopify"));
  assert.deepEqual(
    customer.map((item) => item.href),
    [
      "/app",
      "/app/design-studio",
      "/app/creative-studio",
      "/app/ugc-video-studio",
      "/app/library",
      "/app/credits",
      "/app/account",
    ],
  );
  assert.ok(!customer.some((item) => item.id === "ceo" || item.id === "shopify"));
  assert.deepEqual(
    customer.map((item) => item.label),
    [
      "Home",
      "Design Studio",
      "Creative Studio",
      "UGC Video Studio",
      "Bibliothek",
      "Credits / Plan",
      "Einstellungen / Account",
    ],
  );
});

test("every real customer route has one exact active item", () => {
  const customer = getStudioSidebarSections("de", "CUSTOMER").flatMap(
    (section) => section.items,
  );
  const routes = [
    "/app",
    "/app/design-studio",
    "/app/creative-studio",
    "/app/ugc-video-studio",
    "/app/library",
    "/app/credits",
    "/app/account",
  ];
  for (const pathname of routes) {
    const active = customer.filter((item) => isSidebarNavItemActive(pathname, item));
    assert.equal(active.length, 1, `${pathname} must resolve one active item`);
    assert.equal(active[0]?.href, pathname);
  }
  const home = customer.find((item) => item.id === "home");
  assert.ok(home);
  assert.equal(isSidebarNavItemActive("/app/library", home), false);
});

test("customer and Owner shells each mount the one shared drawer at shell level", () => {
  const customerNav = readFileSync("components/xeriano/customer-nav.tsx", "utf8");
  const dashboardShell = readFileSync("components/layout/dashboard-shell.tsx", "utf8");
  const shared = readFileSync("components/navigation/studio-mobile-navigation.tsx", "utf8");
  const creative = readFileSync("components/creative-studio/creative-studio-workspace.tsx", "utf8");
  const ugc = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  assert.match(customerNav, /StudioMobileNavigation audience="CUSTOMER"/);
  assert.match(dashboardShell, /StudioMobileNavigation audience="OWNER"/);
  assert.equal((dashboardShell.match(/StudioMobileNavigation audience="OWNER"/g) ?? []).length, 1);
  assert.doesNotMatch(customerNav, /useState\(false\)|xeriano-mobile-drawer|const items=/);
  assert.match(shared, /const brand = "Xeriamo"/);
  assert.match(shared, /audience === "CUSTOMER" \? "Creator Suite" : "Owner Workspace"/);
  assert.match(shared, /is-\$\{audience\.toLowerCase\(\)\}/);
  assert.match(shared, /data-audience=\{audience\}/);
  assert.match(shared, /getStudioSidebarSections\(locale, audience\)/);
  assert.doesNotMatch(creative, /CreativeMobileNavigation|StudioMobileNavigation/);
  assert.doesNotMatch(ugc, /UgcMobileNavigation|StudioMobileNavigation/);
  assert.equal(existsSync("components/creative-studio/creative-mobile-navigation.tsx"), false);
  assert.equal(existsSync("components/ugc-video-studio/ugc-mobile-navigation.tsx"), false);
  assert.equal(existsSync("components/layout/app-sidebar.tsx"), false);
});

test("shared drawer is flat, scrollable and has one clean active route treatment", () => {
  const css = readFileSync("app/hq-navigation.css", "utf8");
  assert.match(css, /\.studio-mobile-nav-drawer > nav \{[\s\S]*overflow-y: auto/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
  assert.match(css, /\.studio-mobile-nav-drawer nav a\.is-active/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /\.studio-mobile-nav-drawer\.is-customer/);
  assert.match(css, /min-height: 54px/);
  assert.match(css, /overflow-x: hidden/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const navBlock = css.slice(
    css.indexOf(".studio-mobile-nav-drawer > nav {"),
    css.indexOf(".studio-mobile-nav-drawer nav section + section"),
  );
  assert.doesNotMatch(navBlock, /border:/);
});

test("shared Owner/customer drawer geometry is safe at supported iPhone widths", () => {
  const supportedWidths = [375, 390, 414, 430];
  for (const viewportWidth of supportedWidths) {
    const drawerWidth = Math.min(viewportWidth * 0.91, 368);
    assert.ok(drawerWidth <= viewportWidth);
    assert.ok(drawerWidth >= 341, `${viewportWidth}px keeps comfortable drawer width`);
  }
  const css = readFileSync("app/hq-navigation.css", "utf8");
  assert.match(css, /width: min\(91vw, 368px\)/);
  assert.match(css, /max-width: 100vw/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /touch-action: pan-y/);
});

test("Owner navigation has one canonical route authority and exact active routes", () => {
  const owner = getStudioSidebarSections("de", "OWNER").flatMap(
    (section) => section.items,
  );
  assert.deepEqual(
    owner.map((item) => item.label),
    [
      "CEO",
      "Research Studio",
      "Design Studio",
      "Persona Studio",
      "Image Studio",
      "Creative Studio",
      "UGC Video Studio",
      "Video Studio",
      "Produktbibliothek",
      "Shopify Studio",
      "Kunden",
      "Einstellungen",
    ],
  );
  const customers = owner.find((item) => item.href === "/hq/customers");
  const creative = owner.find((item) => item.href === "/creative-studio");
  const ugc = owner.find((item) => item.href === "/ugc-video-studio");
  const video = owner.find((item) => item.id === "video");
  assert.ok(customers && creative && ugc && video);
  assert.equal(isSidebarNavItemActive("/hq/customers/customer-id", customers), true);
  assert.equal(isSidebarNavItemActive("/creative-studio", creative), true);
  assert.equal(isSidebarNavItemActive("/ugc-video-studio", ugc), true);
  assert.equal(isSidebarNavItemActive(video.href, video), true);
});

test("Owner shell and both canonical navigation surfaces use Xeriamo branding", () => {
  const dashboardShell = readFileSync("components/layout/dashboard-shell.tsx", "utf8");
  const desktop = readFileSync("components/navigation/hq-sidebar.tsx", "utf8");
  const mobile = readFileSync("components/navigation/studio-mobile-navigation.tsx", "utf8");
  const locale = readFileSync("lib/i18n/locales/de/hq-navigation.ts", "utf8");
  const activeOwnerNavigation = dashboardShell + desktop + mobile + locale;
  assert.match(activeOwnerNavigation, /Xeriamo/);
  assert.match(dashboardShell, /Owner Workspace/);
  assert.match(desktop, /hq-sidebar-logo-mark">X/);
  assert.doesNotMatch(activeOwnerNavigation, /NexHQ/);
});

test("Owner drawer scroll and shell scroll-lock are iPhone safe and reversible", () => {
  const shared = readFileSync("components/navigation/studio-mobile-navigation.tsx", "utf8");
  const css = readFileSync("app/hq-navigation.css", "utf8");
  assert.match(css, /\.studio-mobile-nav-drawer \{[\s\S]*height: 100dvh/);
  assert.match(css, /\.studio-mobile-nav-drawer > nav \{[\s\S]*overflow-y: auto/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /touch-action: pan-y/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.hq-sidebar \{\s*display: none !important/);
  assert.match(css, /\.hq-owner-mobile-header \{[\s\S]*display: flex/);
  assert.match(shared, /snapshot = lockBody\(\)/);
  assert.match(shared, /restoreBody\(snapshot\)/);
  assert.match(shared, /window\.scrollTo\(0, snapshot\.scrollY\)/);
  assert.match(shared, /event\.key === "Escape"/);
  assert.match(shared, /onPointerDown=\{close\}/);
  assert.match(shared, /triggerRef\.current\?\.focus\(\)/);
});

test("Owner Customer Center inherits DashboardShell and cannot mount another drawer", () => {
  const layout = readFileSync("app/(dashboard)/layout.tsx", "utf8");
  const dashboardShell = readFileSync("components/layout/dashboard-shell.tsx", "utf8");
  const customers = readFileSync("app/(dashboard)/hq/customers/page.tsx", "utf8");
  const customerDetail = readFileSync(
    "app/(dashboard)/hq/customers/[accountId]/page.tsx",
    "utf8",
  );
  assert.match(layout, /<DashboardShell>\{children\}<\/DashboardShell>/);
  assert.match(dashboardShell, /StudioMobileNavigation audience="OWNER"/);
  assert.doesNotMatch(customers + customerDetail, /Sidebar|MobileNavigation|mobile-nav-trigger/);
  assert.match(layout, /hasXerianoOwnerAuthority\(access\.context\)/);
});
