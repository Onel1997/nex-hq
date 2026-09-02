import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isXeriamoOwnerProductRoute } from "./owner-product-routes";

const read = (path: string) => readFileSync(path, "utf8");

test("only normal Xeriamo Owner product routes receive the product surface", () => {
  for (const route of [
    "/hq/home",
    "/hq/design-studio",
    "/hq/creative-studio",
    "/hq/ugc-video-studio",
    "/hq/library",
    "/hq/library/creation-id",
    "/hq/credits",
  ]) {
    assert.equal(isXeriamoOwnerProductRoute(route), true, route);
  }
  for (const route of [
    "/hq",
    "/hq/customers",
    "/hq/customers/account-id",
    "/settings",
    "/agents/design",
    "/agents/persona",
    "/app/design-studio",
  ]) {
    assert.equal(isXeriamoOwnerProductRoute(route), false, route);
  }
});

test("DashboardShell applies one conditional Owner-only product wrapper", () => {
  const shell = read("components/layout/dashboard-shell.tsx");
  assert.match(shell, /usePathname\(\)/);
  assert.match(shell, /isXeriamoOwnerProductRoute\(pathname\)/);
  assert.match(shell, /ownerProductRoute \? " is-owner-product" : ""/);
  assert.match(shell, /ownerProductRoute \? " xeriamo-owner-product" : ""/);
  assert.match(shell, /StudioMobileNavigation audience="OWNER"/);
});

test("Owner product geometry mirrors the customer content canvas without changing it", () => {
  const customerCss = read("app/xeriano.css");
  const ownerCss = read("app/hq-navigation.css");
  assert.match(customerCss, /\.xeriano-customer-main\{min-width:0;padding:42px clamp\(20px,4vw,58px\) 100px\}/);
  assert.match(ownerCss, /\.xeriamo-owner-product \{[\s\S]*padding: 42px clamp\(20px, 4vw, 58px\) 100px/);
  assert.match(ownerCss, /@media \(max-width: 900px\)[\s\S]*\.xeriamo-owner-product \{[\s\S]*padding: 28px 16px 100px/);
  assert.match(ownerCss, /\.hq-app-layout\.is-owner-product[\s\S]*height: auto;[\s\S]*overflow: visible/);
  assert.match(ownerCss, /\.hq-app-layout\.is-owner-product > \.hq-sidebar \{[\s\S]*position: sticky/);
});

test("Owner fixed Studio actions bind to the Owner rail and mobile viewport", () => {
  const css = read("app/hq-navigation.css");
  assert.match(css, /--cs-sidebar-offset: 15rem/);
  assert.match(css, /--uv-sidebar-offset: 15rem/);
  assert.match(css, /hq-sidebar\.is-collapsed[\s\S]*--cs-sidebar-offset: 4\.25rem/);
  assert.match(css, /hq-sidebar\.is-collapsed[\s\S]*--uv-sidebar-offset: 4\.25rem/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*--cs-sidebar-offset: 0px/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*--uv-sidebar-offset: 0px/);
});

test("Creative and UGC Owner modes keep customer markup defaults unchanged", () => {
  const creative = read("components/creative-studio/creative-studio-workspace.tsx");
  const creativeCss = read("app/creative-studio.css");
  const ugc = read("components/ugc-video-studio/ugc-video-studio-workspace.tsx");
  const ugcCss = read("app/ugc-video-studio.css");
  assert.match(creative, /creative-studio-shell\$\{props\.ownerMode \? " is-owner-product-mode" : ""\}/);
  assert.match(ugc, /ugc-video-studio-shell\$\{props\.ownerMode \? " is-owner-product-mode" : ""\}/);
  assert.doesNotMatch(creativeCss, /\.creative-studio-shell\.is-owner-product-mode \.cs-quick-bar/);
  assert.match(ugcCss, /\.ugc-video-studio-shell\.is-owner-product-mode \.uv-generate-bar/);
  assert.match(creative, /props\.customerMode \? `Generieren · \$\{customerCredits\} Credits` : props\.ownerMode \? `Generieren · ca\. \$\{formattedOwnerCostUsd\}` : "Generieren"/);
  assert.match(ugc, /props\.customerMode && customerCredits !== null[\s\S]*`Generieren · \$\{customerCredits\} Credits`/);
  assert.match(ugc, /props\.ownerMode && estimatedMaximumCostUsd !== null[\s\S]*`Generieren · ca\. \$\{estimatedMaximumCostUsd\.toFixed\(2\)/);
  assert.doesNotMatch(creativeCss, /(?:^|\n)\.cs-quick-bar\{[^}]*flex-direction:column/);
  assert.doesNotMatch(ugcCss, /(?:^|\n)\.uv-generate-bar\{[^}]*flex-direction:column/);
});

test("customer routes and navigation never receive Owner surface authority", () => {
  const customerLayout = read("app/(customer)/app/layout.tsx");
  const customerRoutes = [
    "app/(customer)/app/page.tsx",
    "app/(customer)/app/design-studio/page.tsx",
    "app/(customer)/app/creative-studio/page.tsx",
    "app/(customer)/app/ugc-video-studio/page.tsx",
    "app/(customer)/app/library/page.tsx",
    "app/(customer)/app/credits/page.tsx",
  ].map(read).join("\n");
  assert.match(customerLayout, /xeriano-customer-shell/);
  assert.match(customerLayout, /xeriano-customer-main/);
  assert.doesNotMatch(customerLayout + customerRoutes, /xeriamo-owner-product|is-owner-product-mode|ownerMode|Owner · Unlimited/);
  assert.match(customerRoutes, /customerMode/);
  assert.match(customerLayout, /XerianoCustomerNav/);
  assert.match(customerRoutes, /Credits & Plan/);
  assert.match(customerRoutes, /XerianoLibraryGrid/);
  assert.match(customerRoutes, /CustomerDesignStudio/);
});

test("Owner product copy is premium and omits implementation language", () => {
  const home = read("app/(dashboard)/hq/home/page.tsx");
  const credits = read("app/(dashboard)/hq/credits/page.tsx");
  const creative = read("components/creative-studio/creative-studio-workspace.tsx");
  const ugc = read("components/ugc-video-studio/ugc-video-studio-workspace.tsx");
  assert.match(home + credits + creative + ugc, /Owner · Unlimited|Owner Unlimited/);
  assert.doesNotMatch(home + credits, /Keine Credit-Abbuchung|Credit-Reservierung|Provider-Kostenlimit|interne Laufdaten/);
  assert.doesNotMatch(creative, /Owner Unlimited · keine Credit-Abbuchung|Owner Unlimited · Provider-Kostenlimit aktiv/);
  assert.doesNotMatch(ugc, /Keine Credit-Abbuchung · Provider-Kostenlimit bleibt aktiv/);
});
