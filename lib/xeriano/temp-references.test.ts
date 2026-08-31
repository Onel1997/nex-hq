import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const migration = read(
  "supabase/migrations/20260831181745_xeriano_temp_references_v1.sql",
);
const server = read("lib/xeriano/temp-references/server.ts");
const client = read("lib/xeriano/temp-references/client.ts");
const creativeClient = read("lib/creative-studio/client.ts");
const creativeRoute = read("app/api/creative-studio/generate/route.ts");
const ugcClient = read("lib/ugc-video-studio/client.ts");
const ugcRoute = read("app/api/ugc-video-studio/generate/route.ts");

test("temporary-reference migration is private, bounded and service-authoritative", () => {
  assert.match(migration, /create table public\.xeriano_temp_references/);
  assert.match(migration, /CREATIVE_STUDIO/);
  assert.match(migration, /UGC_VIDEO_STUDIO/);
  assert.match(migration, /expires_at timestamptz not null default \(now\(\) \+ interval '24 hours'\)/);
  assert.match(migration, /'xeriamo-temp-references',[\s\S]*false,[\s\S]*209715200/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.xeriano_temp_references from public,anon,authenticated/);
  assert.match(migration, /grant all on public\.xeriano_temp_references to service_role/);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
});

test("signed upload is one-path scoped and browser keeps opaque authority", () => {
  assert.match(server, /createSignedUploadUrl\(storagePath, \{ upsert: false \}\)/);
  assert.match(server, /accounts\/\$\{input\.context\.accountId\}\/references\/\$\{id\}/);
  assert.match(client, /uploadToSignedUrl\(slot\.path, slot\.token, input\.file/);
  assert.match(client, /return \{ tempReferenceId: slot\.referenceId \}/);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|FAL_KEY/);
  assert.doesNotMatch(migration, /public\s*,\s*true/i);
});

test("account, actor, studio, expiry and completed-object checks fail closed", () => {
  assert.match(server, /\.eq\("account_id", input\.context\.accountId\)/);
  assert.match(server, /\.eq\("actor_user_id", input\.context\.userId\)/);
  assert.match(server, /row\.studio !== input\.studio/);
  assert.match(server, /TEMP_REFERENCE_EXPIRED/);
  assert.match(server, /row\.upload_state !== "READY" && row\.upload_state !== "BOUND"/);
  assert.match(server, /storage\.info\(row\.storage_path\)/);
  assert.match(server, /signatureMatches/);
  assert.match(server, /createSignedUrl\([\s\S]*XERIAMO_PROVIDER_REFERENCE_URL_TTL_SECONDS/);
});

test("Creative and UGC generation payloads contain ids/configuration, never file bodies", () => {
  for (const source of [creativeClient, ugcClient]) {
    assert.match(source, /JSON\.stringify\(\{/);
    assert.match(source, /tempReferenceId/);
    assert.doesNotMatch(source, /formData\.append\("reference"/);
  }
  for (const route of [creativeRoute, ugcRoute]) {
    assert.match(route, /request\.json\(\)/);
    assert.match(route, /resolveTempReferences/);
    assert.doesNotMatch(route, /formData\.getAll\("reference"\)/);
  }
});

test("reference validation precedes customer reservation and binding follows it", () => {
  for (const route of [creativeRoute, ugcRoute]) {
    assert.ok(
      route.indexOf("resolveTempReferences({") <
        route.lastIndexOf("reserveCustomerGeneration({"),
    );
    assert.ok(
      route.lastIndexOf("reserveCustomerGeneration({") <
        route.indexOf("bindTempReferences({"),
    );
  }
  assert.match(creativeRoute, /error instanceof XerianoTempReferenceError/);
  assert.match(ugcRoute, /error instanceof XerianoTempReferenceError/);
});

test("signed provider URLs remain server-only and never become durable setup truth", () => {
  assert.doesNotMatch(creativeClient, /providerUrl|signedUrl/);
  assert.doesNotMatch(ugcClient, /providerUrl|signedUrl/);
  assert.doesNotMatch(read("lib/creative-studio/server-contracts.ts"), /providerUrl|signedUrl/);
  assert.doesNotMatch(read("lib/ugc-video-studio/server-contracts.ts"), /providerUrl|signedUrl/);
  assert.match(read("lib/creative-studio/providers/fal-nano-banana.ts"), /reference\.providerUrl \?\?/);
  assert.match(read("lib/ugc-video-studio/providers/fal-kling-motion-control.ts"), /reference\.providerUrl \?\?/);
});

test("removal cannot delete a reference already bound to provider recovery", () => {
  assert.match(server, /if \(row\.upload_state === "BOUND"\) return \{ deleted: false as const \}/);
  assert.match(server, /bound_job_id: input\.jobId/);
});

