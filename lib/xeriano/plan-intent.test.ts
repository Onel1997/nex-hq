import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  getXerianoPlanIntentPresentation,
  parseXerianoPlanIntent,
  sanitizeXerianoAuthDestination,
  withXerianoPlanIntent,
} from "./plan-intent";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("paid plan intent is allowlisted and resolves through the canonical catalog", () => {
  assert.deepEqual(
    ["CREATOR_MONTHLY", "PRO_MONTHLY", "STUDIO_MONTHLY", "MAX_MONTHLY"].map((value) => {
      const intent = getXerianoPlanIntentPresentation(value)!;
      return [intent.productCode, intent.planCode, intent.grossPriceMinor, intent.grantedCredits];
    }),
    [
      ["CREATOR_MONTHLY", "CREATOR", 1_900, 700],
      ["PRO_MONTHLY", "PRO", 3_900, 1_400],
      ["STUDIO_MONTHLY", "STUDIO", 6_900, 2_500],
      ["MAX_MONTHLY", "MAX", 11_900, 4_250],
    ],
  );
  assert.equal(parseXerianoPlanIntent("price_secret"), null);
  assert.equal(parseXerianoPlanIntent("FREE"), null);
  assert.equal(parseXerianoPlanIntent("CREATOR_MONTHLY?credits=999"), null);
});

test("plan intent survives Register, Login and authenticated Credits without financial inputs", () => {
  for (const code of ["CREATOR_MONTHLY", "PRO_MONTHLY", "STUDIO_MONTHLY", "MAX_MONTHLY"] as const) {
    const register = withXerianoPlanIntent("/register", code);
    const login = withXerianoPlanIntent("/login", new URL(register, "https://xeriano.test").searchParams.get("plan"));
    const credits = withXerianoPlanIntent("/app/credits", new URL(login, "https://xeriano.test").searchParams.get("plan"));
    assert.equal(register, `/register?plan=${code}`);
    assert.equal(login, `/login?plan=${code}`);
    assert.equal(credits, `/app/credits?plan=${code}`);
    assert.doesNotMatch(credits, /price|credits=|amount|currency/i);
  }
});

test("auth callback destinations reject open redirects and strip untrusted parameters", () => {
  assert.equal(sanitizeXerianoAuthDestination("https://evil.test"), "/app");
  assert.equal(sanitizeXerianoAuthDestination("//evil.test/path"), "/app");
  assert.equal(sanitizeXerianoAuthDestination("javascript:alert(1)"), "/app");
  assert.equal(sanitizeXerianoAuthDestination("/api/xeriano/billing/checkout"), "/app");
  assert.equal(
    sanitizeXerianoAuthDestination("/app/credits?plan=PRO_MONTHLY&price=price_injected&credits=999"),
    "/app/credits?plan=PRO_MONTHLY",
  );
  assert.equal(
    sanitizeXerianoAuthDestination("/reset-password?mode=update&plan=STUDIO_MONTHLY&next=https://evil.test"),
    "/reset-password?mode=update&plan=STUDIO_MONTHLY",
  );
});

test("all auth views share the Xeriamo shell and prospectively show 30 Free credits", () => {
  const register = read("app/register/page.tsx");
  const login = read("app/login/page.tsx");
  const reset = read("app/reset-password/page.tsx");
  for (const source of [register, login, reset]) assert.match(source, /XerianoAuthShell/);
  assert.match(register, /resolveActiveXerianoPlan\("FREE"\)/);
  assert.doesNotMatch(register + login + reset, /40 Credits/);
  assert.match(
    read("components/xeriano/auth-shell.tsx"),
    /XeriamoBrandLockup/,
  );
});

test("auth and plan-intent navigation have zero credit or Stripe effects", () => {
  const sources = [
    "lib/xeriano/plan-intent.ts",
    "app/register/actions.ts",
    "app/login/actions.ts",
    "app/reset-password/actions.ts",
  ].map(read).join("\n");
  assert.doesNotMatch(sources, /reserveXeriano|commitCredit|grantCredit|checkout\.sessions|new Stripe|stripe\./i);
});
