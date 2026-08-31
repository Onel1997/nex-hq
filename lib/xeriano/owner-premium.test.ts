import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveXerianoGenerationAuthority,
  type XerianoAccountContext,
} from "./access-policy";

const read = (path: string) => readFileSync(path, "utf8");

function context(
  role: XerianoAccountContext["role"],
  options: { internalOwner?: boolean; source?: XerianoAccountContext["source"] } = {},
): XerianoAccountContext {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "actor@example.test",
    role,
    accountId: "22222222-2222-4222-8222-222222222222",
    accountName: "Account",
    workspaceKey: "account-workspace",
    brainWorkspaceId: null,
    source: options.source ?? "XERIANO_MEMBERSHIP",
    internalOwner: options.internalOwner,
  };
}

test("exact trusted Owner receives OWNER_UNLIMITED while ADMIN and CUSTOMER do not", () => {
  assert.equal(resolveXerianoGenerationAuthority(context("OWNER")), "OWNER_UNLIMITED");
  assert.equal(
    resolveXerianoGenerationAuthority(context("CUSTOMER", { internalOwner: true })),
    "OWNER_UNLIMITED",
  );
  assert.equal(resolveXerianoGenerationAuthority(context("CUSTOMER")), "CUSTOMER_CREDITS");
  assert.equal(resolveXerianoGenerationAuthority(context("ADMIN")), null);
  assert.equal(
    resolveXerianoGenerationAuthority(
      context("CUSTOMER", { source: "LEGACY_OWNER", internalOwner: false }),
    ),
    null,
  );
});

test("Owner product routes reuse modern Xeriamo cores inside DashboardShell", () => {
  const layout = read("app/(dashboard)/layout.tsx");
  const home = read("app/(dashboard)/hq/home/page.tsx");
  const design = read("app/(dashboard)/hq/design-studio/page.tsx");
  const creative = read("app/(dashboard)/hq/creative-studio/page.tsx");
  const ugc = read("app/(dashboard)/hq/ugc-video-studio/page.tsx");
  const credits = read("app/(dashboard)/hq/credits/page.tsx");
  assert.match(layout, /DashboardShell/);
  assert.match(home, /Owner Unlimited/);
  assert.match(design, /CustomerDesignStudio audience="OWNER"/);
  assert.match(creative, /CreativeStudioWorkspace/);
  assert.match(creative, /ownerMode/);
  assert.match(ugc, /UgcVideoStudioWorkspace/);
  assert.match(ugc, /ownerMode/);
  assert.match(credits, /Owner Unlimited/);
  assert.doesNotMatch(home + design + creative + ugc + credits, /CustomerNav|StudioMobileNavigation/);
});

test("modern and internal Design Studios remain separate Owner tools", () => {
  const navigation = read("lib/i18n/data/hq-navigation.ts");
  const modern = read("app/(dashboard)/hq/design-studio/page.tsx");
  const internal = read("app/(dashboard)/agents/design/page.tsx");
  assert.match(navigation, /href: "\/hq\/design-studio"/);
  assert.match(navigation, /id: "designer-internal"/);
  assert.match(navigation, /Design Studio Intern/);
  assert.match(modern, /CustomerDesignStudio/);
  assert.match(internal, /DesignStudioCenter/);
  assert.doesNotMatch(modern, /DesignStudioCenter/);
});

test("Owner product generation skips reservations but customer charging remains", () => {
  const guard = read("lib/xeriano/credit-guard.ts");
  const creative = read("app/api/creative-studio/generate/route.ts");
  const ugc = read("app/api/ugc-video-studio/generate/route.ts");
  assert.match(guard, /OWNER_UNLIMITED/);
  for (const route of [creative, ugc]) {
    assert.match(route, /authorization\.bypass === null/);
    assert.match(route, /reserveCustomerGeneration/);
  }
  assert.match(creative, /ownerUnlimited/);
  assert.match(creative, /credit_cost|ownerUnlimitedPricingVersion/);
  assert.doesNotMatch(guard, /role === "ADMIN"/);
});

test("Owner UI presents monetary Creative cost while financial authority remains unlimited", () => {
  const creative = read("components/creative-studio/creative-studio-workspace.tsx");
  const ugc = read("components/ugc-video-studio/ugc-video-studio-workspace.tsx");
  assert.match(creative, /props\.ownerMode/);
  assert.match(creative, /Geschätzte Kosten · ca\./);
  assert.match(creative, /`Generieren · ca\. \$\{formattedOwnerCostUsd\}`/);
  assert.doesNotMatch(creative, /NEXHQ_CREATIVE_NANO_BANANA_COST_MAX_USD/);
  assert.match(creative, /`Generieren · \$\{customerCredits\} Credits`/);
  assert.match(ugc, /props\.ownerMode/);
  assert.match(ugc, /Owner · Unlimited/);
  assert.match(ugc, /`Generieren · \$\{customerCredits\} Credits`/);
});

test("Owner product routes require account membership for private assets", () => {
  for (const route of [
    "app/(dashboard)/hq/design-studio/page.tsx",
    "app/(dashboard)/hq/creative-studio/page.tsx",
    "app/(dashboard)/hq/ugc-video-studio/page.tsx",
    "app/(dashboard)/hq/library/page.tsx",
  ]) {
    assert.match(read(route), /hasXerianoAccountMembership/);
  }
  const customerLayout = read("app/(customer)/app/layout.tsx");
  assert.match(customerLayout, /hasXerianoOwnerAuthority/);
  assert.match(customerLayout, /redirect\("\/hq"\)/);
});
