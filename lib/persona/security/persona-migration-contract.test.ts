import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("Persona foundation migration contracts", () => {
  it("Milestone 1 is additive and keeps legacy review provenance nullable", () => {
    const sql = migration("20260816210000_persona_foundation_milestone_1.sql");
    assert.match(sql, /add column if not exists identity_review_id uuid/i);
    assert.match(sql, /add column if not exists identity_reviewed_at timestamptz/i);
    assert.match(sql, /add column if not exists identity_reviewed_by text/i);
    assert.match(
      sql,
      /add column if not exists identity_review_id uuid\s+references public\.persona_identity_reviews\(id\) on delete restrict,/i,
    );
    assert.doesNotMatch(
      sql,
      /\b(drop table|drop column|truncate|delete from|update\s+public\.)\b/i,
    );
  });

  it("Milestone 2 makes Persona tables server-only without permissive policies", () => {
    const sql = migration(
      "20260816220000_persona_foundation_milestone_2_security.sql",
    );
    assert.match(
      sql,
      /revoke all privileges[\s\S]+public, anon, authenticated/i,
    );
    assert.match(sql, /grant all privileges[\s\S]+to service_role/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /drop policy if exists "persona_personas_select"/i);
    assert.match(sql, /drop policy if exists persona_discovery_attempts_service_all/i);
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
  });

  it("new lock writes enforce review workspace/persona consistency", () => {
    const sql = migration(
      "20260816220000_persona_foundation_milestone_2_security.sql",
    );
    assert.match(
      sql,
      /foreign key \(workspace_id, persona_id, identity_review_id\)/i,
    );
    assert.match(sql, /persona_lock_review_scope_fk/i);
    assert.match(sql, /not valid/i);
  });
});
