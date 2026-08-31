import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../supabase/migrations/20260831030000_xeriano_design_studio_generation_authority_v1.sql", import.meta.url);
const provenAuthorityUrl = new URL("../../supabase/migrations/20260830010000_xeriano_customer_generation_authority_v1.sql", import.meta.url);

function authorizationFunction(sql: string) {
  const start = sql.indexOf("create or replace function public.xeriano_authorize_customer_generation");
  assert.notEqual(start, -1);
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1);
  return sql.slice(start, end + 4);
}

test("Design authority migration extends only the trusted studio allowlist", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /studio in \('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO'\)/);
  assert.match(sql, /p_studio not in \('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO'\)/);
  assert.match(sql, /raise exception 'INVALID_CUSTOMER_STUDIO'/);
  assert.match(sql, /xeriano_reserve_credits\(/);
  assert.match(sql, /GENERATION_AUTHORITY_IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /CUSTOMER_ACCOUNT_ACCESS_DENIED/);
});

test("customer reservation implementation is byte-equivalent except for the studio allowlist", async () => {
  const [migration, proven] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(provenAuthorityUrl, "utf8"),
  ]);
  const normalized = authorizationFunction(migration).replace(
    "'CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO'",
    "'CREATIVE_STUDIO','UGC_VIDEO_STUDIO'",
  );
  assert.equal(normalized, authorizationFunction(proven));
});

test("Creation consistency accepts only valid Design, Creative and UGC combinations", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /creation_type = 'IMAGE' and source_studio in \('CREATIVE_STUDIO','DESIGN_STUDIO'\)/);
  assert.match(sql, /creation_type = 'VIDEO' and source_studio = 'UGC_VIDEO_STUDIO'/);
  assert.doesNotMatch(sql, /creation_type = 'VIDEO' and source_studio = 'DESIGN_STUDIO'/);
});

test("SVG extends the same private DESIGN Library authority", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /asset_type = 'DESIGN' and mime_type in \('image\/png','image\/jpeg','image\/webp','image\/svg\+xml'\)/);
  assert.match(sql, /where id = 'xeriano-library-assets'/);
  assert.doesNotMatch(sql, /create table/i);
});

test("RLS and service-only financial mutation remain closed", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.xeriano_generation_authorities, public\.xeriano_creations\s+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});
