import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROTECTED_PERSONA_ROUTES = [
  "app/api/persona/route.ts",
  "app/api/persona/[id]/route.ts",
  "app/api/persona/[id]/identity-review/route.ts",
  "app/api/persona/[id]/identity-lock/route.ts",
  "app/api/persona/[id]/identity-reconciliation/route.ts",
  "app/api/persona/[id]/reference-package/route.ts",
  "app/api/persona/[id]/reference-rights/route.ts",
  "app/api/persona/[id]/references/route.ts",
  "app/api/persona/[id]/references/[assetId]/route.ts",
  "app/api/persona/[id]/use-approvals/route.ts",
  "app/api/persona/brand-cast/route.ts",
  "app/api/persona/brand-looks/route.ts",
  "app/api/persona/brand-looks/[id]/route.ts",
  "app/api/persona/camera/route.ts",
  "app/api/persona/camera/[id]/route.ts",
  "app/api/persona/creation-projects/route.ts",
  "app/api/persona/creation-projects/[id]/route.ts",
  "app/api/persona/creation-projects/[id]/candidates/route.ts",
  "app/api/persona/creation-projects/[id]/novelty-debug/route.ts",
  "app/api/persona/candidates/[id]/route.ts",
  "app/api/persona/integrations/route.ts",
  "app/api/persona/locations/route.ts",
  "app/api/persona/locations/[id]/route.ts",
  "app/api/persona/outfits/route.ts",
  "app/api/persona/outfits/[id]/route.ts",
  "app/api/persona/poses/route.ts",
  "app/api/persona/poses/[id]/route.ts",
] as const;

describe("Persona protected API boundary", () => {
  it("routes durable identity and approval operations through one guard", () => {
    for (const relativePath of PROTECTED_PERSONA_ROUTES) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      assert.match(source, /requirePersonaScope\(\)/, relativePath);
      assert.match(source, /if \(!(?:gate|gated)\.ok\)/, relativePath);
    }
  });

  it("the shared guard maps missing authentication to HTTP 401", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/persona/_utils.ts"),
      "utf8",
    );
    assert.match(source, /AUTHENTICATION_REQUIRED/);
    assert.match(source, /\? 401/);
    assert.match(source, /resolvePersonaWorkspaceScope\(\)/);
  });
});
