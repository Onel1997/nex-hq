import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  logXeriamoRegistrationUnavailable,
  resolveXeriamoRegistrationEnvironment,
  resolveXeriamoRegistrationSchema,
  XERIAMO_REGISTRATION_ENV_NAMES,
  XERIAMO_REGISTRATION_SCHEMA_CHECKS,
} from "./registration-readiness";

const stagingUrl = "https://wwfezmywxishfgwnijyd.supabase.co";
const validEnvironment = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "present-not-a-real-key",
  SUPABASE_SERVICE_ROLE_KEY: "present-not-a-real-key",
};

test("Vercel Production intentionally accepts the isolated staging project for Private Beta", () => {
  const result = resolveXeriamoRegistrationEnvironment(validEnvironment);
  assert.equal(result.ready, true);
  assert.equal(result.flags.privateBetaTarget, true);
  assert.deepEqual(XERIAMO_REGISTRATION_ENV_NAMES, [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
});

test("missing registration authority fails closed before any schema or signup operation", () => {
  let networkOperation = false;
  const result = resolveXeriamoRegistrationEnvironment({
    ...validEnvironment,
    SUPABASE_SERVICE_ROLE_KEY: "",
  });
  if (result.ready) networkOperation = true;
  assert.equal(result.ready, false);
  assert.equal(result.code, "REGISTRATION_SERVICE_AUTHORITY_MISSING");
  assert.equal(networkOperation, false);
});

test("Private Beta never targets the production Supabase project", () => {
  const result = resolveXeriamoRegistrationEnvironment({
    ...validEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: "https://lggogmvpktedkimbpzix.supabase.co",
  });
  assert.equal(result.ready, false);
  assert.equal(result.code, "REGISTRATION_PRODUCTION_SUPABASE_FORBIDDEN");
});

test("valid schema readiness reaches all required pre-signup probes", async () => {
  const probed: string[] = [];
  const result = await resolveXeriamoRegistrationSchema(async ({ table }) => {
    probed.push(table);
    return { error: null };
  });
  assert.equal(result.ready, true);
  assert.deepEqual(probed, XERIAMO_REGISTRATION_SCHEMA_CHECKS.map(({ table }) => table));
});

test("each missing schema authority fails closed with a stable server-only code", async () => {
  for (const failedCheck of XERIAMO_REGISTRATION_SCHEMA_CHECKS) {
    const result = await resolveXeriamoRegistrationSchema(async ({ table }) => ({
      error: table === failedCheck.table ? new Error("redacted") : null,
    }));
    assert.equal(result.ready, false);
    assert.equal(result.code, failedCheck.code);
  }
});

test("credential rejection and network failure are distinct from missing schema", async () => {
  const rejected = await resolveXeriamoRegistrationSchema(async () => ({
    error: new Error("redacted"),
    status: 401,
  }));
  const unreachable = await resolveXeriamoRegistrationSchema(async () => ({
    error: new Error("redacted"),
    status: 0,
  }));
  assert.deepEqual(rejected, { ready: false, code: "REGISTRATION_SERVICE_AUTHORITY_REJECTED" });
  assert.deepEqual(unreachable, { ready: false, code: "REGISTRATION_SUPABASE_UNREACHABLE" });
});

test("registration diagnostics contain booleans and stable codes but no authority values", () => {
  const captured: unknown[][] = [];
  logXeriamoRegistrationUnavailable({
    code: "REGISTRATION_SCHEMA_ACCOUNTS_UNAVAILABLE",
    stage: "schema",
    flags: resolveXeriamoRegistrationEnvironment(validEnvironment).flags,
    logger: { error: (...args: unknown[]) => captured.push(args) },
  });
  const serialized = JSON.stringify(captured);
  assert.match(serialized, /REGISTRATION_SCHEMA_ACCOUNTS_UNAVAILABLE/);
  assert.doesNotMatch(serialized, /present-not-a-real-key|wwfezmywxishfgwnijyd/);
});

test("signup remains after readiness and prospective provisioning remains exactly 30 once", () => {
  const action = readFileSync("app/register/actions.ts", "utf8");
  const economy = readFileSync("supabase/migrations/20260830160000_xeriano_final_plan_hierarchy_v2.sql", "utf8");
  assert.ok(action.indexOf("resolveXeriamoRegistrationSchema") < action.indexOf("auth.signUp"));
  assert.match(economy, /values\(new\.id,'TRIAL','trial:v2',30,30\)/);
  assert.match(economy, /on conflict\(account_id,source_key\) do nothing/);
  assert.match(economy, /'trial:v2:'\|\|new\.id/);
});
