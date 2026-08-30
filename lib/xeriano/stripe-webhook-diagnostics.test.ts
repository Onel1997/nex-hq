import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as webhookPost } from "@/app/api/xeriano/billing/webhook/route";
import {
  decideNexhqAuthRouting,
  isPublicNexhqPath,
  isSessionlessStripeWebhookPath,
  XERIANO_STRIPE_WEBHOOK_PATH,
} from "@/lib/auth/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { logXerianoWebhookDiagnostic } from "./stripe-webhook-diagnostics";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const secret = "whsec_test_diagnostic_only";
const stagingEnv = {
  STRIPE_SECRET_KEY: "sk_test_diagnostic_only",
  STRIPE_WEBHOOK_SECRET: secret,
  NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co",
  NEXT_PUBLIC_APP_URL: "http://192.168.2.90:3000",
};

async function withEnvironment<T>(
  patch: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function signedHeader(payload: string, signingSecret = secret): string {
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function webhookRequest(payload: string, signature?: string): Request {
  return new Request(`http://localhost:3000${XERIANO_STRIPE_WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body: payload,
  });
}

test("only the exact Stripe webhook bypasses normal customer-session middleware", async () => {
  assert.equal(isSessionlessStripeWebhookPath(XERIANO_STRIPE_WEBHOOK_PATH), true);
  assert.equal(isSessionlessStripeWebhookPath(`${XERIANO_STRIPE_WEBHOOK_PATH}/extra`), false);
  assert.equal(isPublicNexhqPath(XERIANO_STRIPE_WEBHOOK_PATH), true);
  assert.deepEqual(
    decideNexhqAuthRouting({ pathname: XERIANO_STRIPE_WEBHOOK_PATH, authenticated: false }),
    { kind: "allow" },
  );
  assert.deepEqual(
    decideNexhqAuthRouting({ pathname: `${XERIANO_STRIPE_WEBHOOK_PATH}/extra`, authenticated: false }),
    { kind: "api_unauthorized", status: 401 },
  );

  const response = await updateSession(new NextRequest(`http://localhost:3000${XERIANO_STRIPE_WEBHOOK_PATH}`, {
    method: "POST",
    body: "signed body remains route-owned",
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("missing and invalid signatures fail closed with 401 without a session", async () => {
  await withEnvironment(stagingEnv, async () => {
    const missing = await webhookPost(webhookRequest("{}"));
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), { received: false, code: "INVALID_STRIPE_SIGNATURE" });

    const invalid = await webhookPost(webhookRequest("{}", "t=1,v1=invalid"));
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { received: false, code: "INVALID_STRIPE_SIGNATURE" });
  });
});

test("a correctly signed exact raw body proceeds beyond auth and signature verification", async () => {
  const payload = '{\n  "id":"evt_test_safe", "object":"event", "type":"test.unsupported", "livemode":false, "data":{"object":{}}\n}';
  await withEnvironment(stagingEnv, async () => {
    const response = await webhookPost(webhookRequest(payload, signedHeader(payload)));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, ignored: true });
  });
  const route = read("app/api/xeriano/billing/webhook/route.ts");
  assert.ok(route.indexOf("payload = await request.text()") < route.indexOf("event = verifyXerianoStripeEvent"));
  assert.doesNotMatch(route.slice(0, route.indexOf("event = verifyXerianoStripeEvent")), /request\.json\(|JSON\.stringify/);
});

test("missing webhook secret fails closed before signature verification", async () => {
  await withEnvironment({ ...stagingEnv, STRIPE_WEBHOOK_SECRET: undefined }, async () => {
    const response = await webhookPost(webhookRequest("{}", "t=1,v1=invalid"));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { received: false, code: "STRIPE_WEBHOOK_NOT_CONFIGURED" });
  });
});

test("a correctly signed live event is explicitly rejected in staging", async () => {
  const payload = JSON.stringify({
    id: "evt_live_safe",
    object: "event",
    type: "test.unsupported",
    livemode: true,
    data: { object: {} },
  });
  await withEnvironment(stagingEnv, async () => {
    const response = await webhookPost(webhookRequest(payload, signedHeader(payload)));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { received: false, code: "LIVE_STRIPE_EVENT_FORBIDDEN" });
  });
});

test("staging diagnostics cannot receive or print secrets, headers, bodies, or Stripe IDs", () => {
  const captured: unknown[] = [];
  logXerianoWebhookDiagnostic({
    code: "WEBHOOK_SIGNATURE_INVALID",
    stage: "signature_verification",
    httpStatus: 401,
  }, stagingEnv, (...args) => captured.push(args));
  assert.deepEqual(captured, [["[xeriano-billing] Webhook rejected", {
    code: "WEBHOOK_SIGNATURE_INVALID",
    stage: "signature_verification",
    httpStatus: 401,
  }]]);
  const serialized = JSON.stringify(captured);
  assert.doesNotMatch(serialized, /whsec_|stripe-signature|evt_|cus_|sub_|in_|price_|raw body/i);

  logXerianoWebhookDiagnostic({
    code: "WEBHOOK_SIGNATURE_INVALID",
    stage: "signature_verification",
    httpStatus: 401,
  }, { ...stagingEnv, NEXT_PUBLIC_SUPABASE_URL: "https://lggogmvpktedkimbpzix.supabase.co" }, (...args) => captured.push(args));
  assert.equal(captured.length, 1);
});

test("dev-staging makes Staging-ENV webhook presence authoritative without exposing its value", () => {
  const runner = read("scripts/dev-staging.mjs");
  assert.match(runner, /"STRIPE_WEBHOOK_SECRET"/);
  assert.match(runner, /const childEnvironment = \{ \.\.\.process\.env, \.\.\.stagingEnvironment \}/);
  assert.match(runner, /childEnvironment\[key\] = stagingEnvironment\[key\] \?\? ""/);
  assert.match(runner, /present \? "vorhanden" : "fehlt"/);
  assert.doesNotMatch(runner, /console\.(?:info|log)\([^\n]*stagingEnvironment\[key\]/);
  assert.doesNotMatch(runner, /readFileSync\("\.env\.local"/);
});

test("webhook settlement remains service-authoritative and account scoped", () => {
  const repository = read("lib/xeriano/billing-settlement-repository.ts");
  const migration = read("supabase/migrations/20260830150000_xeriano_stripe_test_billing_v1.sql");
  assert.match(repository, /xeriano_grant_subscription_invoice/);
  assert.match(repository, /xeriano_grant_topup_checkout/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /stripe_customer_id/);
  assert.match(migration, /account_id/);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
});
