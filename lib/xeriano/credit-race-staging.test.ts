import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/xeriano-credit-race-staging.mjs", "utf8");

test("staging credit race harness is explicit, project-bound, and never reads .env.local", () => {
  assert.match(source, /--execute/);
  assert.match(source, /--project-ref/);
  assert.match(source, /wwfezmywxishfgwnijyd/);
  assert.match(source, /lggogmvpktedkimbpzix/);
  assert.match(source, /readFileSync\("Staging-ENV"/);
  assert.doesNotMatch(source, /readFileSync\("\.env\.local"/);
});

test("staging harness uses two independent clients for real concurrent reservations", () => {
  assert.match(source, /const racerA = createClient/);
  assert.match(source, /const racerB = createClient/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /CONCURRENT_80_80_EXACTLY_ONE_SUCCESS/);
  assert.match(source, /CONCURRENCY_LIMIT_REACHED/);
});

test("staging harness has no provider, generation, Stripe, or production mutation path", () => {
  assert.doesNotMatch(source, /@fal-ai|openai|stripe|\/api\/(?:creative-studio|ugc-video-studio)\/generate/i);
  assert.match(source, /providerCalls: 0/);
  assert.match(source, /status: "CLOSED"/);
});
