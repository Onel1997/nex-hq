import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) { return readFileSync(path, "utf8"); }

test("staging runtime makes Staging-ENV authoritative without editing env files", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  const runner = read("scripts/dev-staging.mjs");

  assert.equal(pkg.scripts["dev:staging"], "node scripts/dev-staging.mjs");
  assert.match(runner, /parseEnv\(readFileSync\("Staging-ENV"/);
  assert.match(runner, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(runner, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(runner, /\{ \.\.\.process\.env, \.\.\.stagingEnvironment \}/);
  assert.match(runner, /rmSync\("\.next", \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(runner, /console\.(?:info|log)\([^\n]*(?:ANON_KEY|SERVICE_ROLE_KEY)/);
});

test("Library failures retain a simple customer message and safe server evidence", () => {
  const route = read("app/api/xeriano/library/route.ts");
  assert.match(route, /\[xeriano-library\] server operation failed/);
  assert.match(route, /const\s*\{\s*data,\s*error,\s*count,\s*status\s*\}\s*=\s*await query/);
  assert.match(route, /REDACTED_SUPABASE_KEY/);
  assert.match(route, /REDACTED_JWT/);
  assert.match(route, /Die Bibliothek ist gerade nicht verfügbar\./);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY.*console|console.*SUPABASE_SERVICE_ROLE_KEY/);
});
