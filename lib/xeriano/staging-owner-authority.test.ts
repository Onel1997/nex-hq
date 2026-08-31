import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getWorkspaceConfig } from "@/brain/workspaces/registry";
import {
  hasXerianoAccountMembership,
  hasXerianoOwnerAuthority,
  selectXerianoAccountContext,
} from "@/lib/xeriano/access-policy";
import { assessTrustedXeriamoApplicationOrigin, isTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";
import { getActiveWorkspace } from "@/lib/workspace/active";

const read = (path: string) => readFileSync(path, "utf8");

describe("Xeriamo staging OWNER and account authority", () => {
  it("keeps OWNER admin authority while preferring a real CUSTOMER membership for /app", () => {
    const context = selectXerianoAccountContext({
      userId: "owner-user",
      email: "owner@example.test",
      legacyOwner: true,
      legacyWorkspaceKey: "xeriano-staging",
      membership: {
        accountId: "11111111-1111-4111-8111-111111111111",
        accountName: "Owner Customer Account",
        workspaceKey: "owner-customer",
        brainWorkspaceId: null,
        role: "CUSTOMER",
      },
    });

    assert.ok(context);
    assert.equal(context.role, "CUSTOMER");
    assert.equal(context.source, "XERIANO_MEMBERSHIP");
    assert.equal(hasXerianoAccountMembership(context), true);
    assert.equal(hasXerianoOwnerAuthority(context), true);
  });

  it("carries a separately resolved active OWNER membership beside the primary account", () => {
    const context = selectXerianoAccountContext({
      userId: "owner-user",
      email: "owner@example.test",
      legacyOwner: false,
      internalOwner: true,
      legacyWorkspaceKey: "xeriano-staging",
      membership: {
        accountId: "11111111-1111-4111-8111-111111111111",
        accountName: "Primary Customer Account",
        workspaceKey: "owner-customer",
        brainWorkspaceId: null,
        role: "CUSTOMER",
      },
    });

    assert.ok(context);
    assert.equal(context.role, "CUSTOMER");
    assert.equal(hasXerianoAccountMembership(context), true);
    assert.equal(hasXerianoOwnerAuthority(context), true);
  });

  it("keeps an OWNER without account membership out of customer account authority", () => {
    const context = selectXerianoAccountContext({
      userId: "owner-user",
      email: null,
      legacyOwner: true,
      legacyWorkspaceKey: "xeriano-staging",
      membership: null,
    });

    assert.ok(context);
    assert.equal(context.source, "LEGACY_OWNER");
    assert.equal(hasXerianoOwnerAuthority(context), true);
    assert.equal(hasXerianoAccountMembership(context), false);
  });

  it("does not elevate CUSTOMER or ADMIN membership to financial OWNER", () => {
    for (const role of ["CUSTOMER", "ADMIN"] as const) {
      const context = selectXerianoAccountContext({
        userId: `${role.toLowerCase()}-user`,
        email: null,
        legacyOwner: false,
        legacyWorkspaceKey: "unused",
        membership: {
          accountId: "22222222-2222-4222-8222-222222222222",
          accountName: "Customer",
          workspaceKey: "customer",
          brainWorkspaceId: null,
          role,
        },
      });
      assert.ok(context);
      assert.equal(hasXerianoOwnerAuthority(context), false);
    }
  });

  it("accepts the configured LAN application origin without trusting arbitrary origins", () => {
    const input = {
      requestUrl: "http://localhost:3000/api/hq/customers/account/credits",
      applicationUrl: "http://192.168.2.90:3000",
    };
    assert.equal(isTrustedXeriamoApplicationOrigin({
      ...input,
      originHeader: "http://192.168.2.90:3000",
    }), true);
    assert.equal(isTrustedXeriamoApplicationOrigin({
      ...input,
      originHeader: "https://attacker.example",
    }), false);
    assert.equal(isTrustedXeriamoApplicationOrigin({
      ...input,
      originHeader: null,
    }), false);
  });

  it("binds a staging-development LAN Origin to the exact current application Host", () => {
    const trusted = assessTrustedXeriamoApplicationOrigin({
      requestUrl: "http://localhost:3000/api/hq/branding",
      applicationUrl: "https://xeriamo.com",
      originHeader: "http://192.168.178.49:3000",
      hostHeader: "192.168.178.49:3000",
      environment: "development",
    });
    assert.deepEqual(trusted, { allowed: true, originPresent: true, hostMatch: true });

    assert.equal(isTrustedXeriamoApplicationOrigin({
      requestUrl: "http://localhost:3000/api/hq/branding",
      applicationUrl: "https://xeriamo.com",
      originHeader: "http://192.168.178.49:3000",
      hostHeader: "localhost:3000",
      forwardedHostHeader: "192.168.178.49:3000",
      forwardedProtoHeader: "http",
      environment: "development",
    }), true);

    assert.equal(isTrustedXeriamoApplicationOrigin({
      requestUrl: "http://192.168.178.49:3000/api/hq/branding",
      applicationUrl: "https://xeriamo.com",
      originHeader: "https://attacker.example",
      hostHeader: "192.168.178.49:3000",
      forwardedHostHeader: "attacker.example",
      forwardedProtoHeader: "https",
      environment: "development",
    }), false);

    assert.equal(isTrustedXeriamoApplicationOrigin({
      requestUrl: "http://localhost:3000/api/hq/branding",
      applicationUrl: "https://xeriamo.com",
      originHeader: "https://attacker.example",
      hostHeader: "192.168.178.49:3000",
      environment: "development",
    }), false);

    assert.equal(isTrustedXeriamoApplicationOrigin({
      requestUrl: "https://xeriamo.com/api/hq/branding",
      applicationUrl: "https://xeriamo.com",
      originHeader: "http://192.168.178.49:3000",
      hostHeader: "192.168.178.49:3000",
      environment: "production",
    }), false);

    assert.equal(isTrustedXeriamoApplicationOrigin({
      requestUrl: "https://attacker.example/api/hq/branding",
      applicationUrl: "https://xeriamo.com",
      originHeader: "https://attacker.example",
      hostHeader: "attacker.example",
      environment: "production",
    }), false);
  });

  it("resolves only the explicit xeriano-staging workspace alias", () => {
    const previous = process.env.NEXHQ_WORKSPACE_SLUG;
    process.env.NEXHQ_WORKSPACE_SLUG = "xeriano-staging";
    try {
      const workspace = getActiveWorkspace();
      assert.equal(workspace.slug, "xeriano-staging");
      assert.equal(workspace.name, "Xeriamo Staging");
      assert.deepEqual(workspace.seedRecords, []);
      assert.equal(getWorkspaceConfig("xeriano-staging"), workspace);
      assert.throws(() => getWorkspaceConfig("unconfigured-staging"), /Unknown workspace/);
    } finally {
      if (previous === undefined) delete process.env.NEXHQ_WORKSPACE_SLUG;
      else process.env.NEXHQ_WORKSPACE_SLUG = previous;
    }
  });

  it("wires owner pages and grants to the separated authorities", () => {
    const dashboard = read("app/(dashboard)/layout.tsx");
    const auth = read("lib/xeriano/auth.ts");
    const ownerService = read("lib/xeriano/owner-customer-center.ts");
    const accountServer = read("lib/xeriano/server.ts");
    const grantRoute = read("app/api/hq/customers/[accountId]/credits/route.ts");
    assert.match(dashboard, /hasXerianoOwnerAuthority/);
    assert.match(auth, /\.eq\("role", "OWNER"\)/);
    assert.match(auth, /internalOwner: activeOwnerMembership/);
    assert.match(ownerService, /hasXerianoOwnerAuthority/);
    assert.match(accountServer, /hasXerianoAccountMembership/);
    assert.match(grantRoute, /isTrustedXeriamoApplicationOrigin/);
    assert.doesNotMatch(grantRoute, /new URL\(origin\)\.origin === new URL\(request\.url\)\.origin/);
  });
});
