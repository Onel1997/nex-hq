import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260818160000_persona_video_readiness_v1.sql",
  "utf8",
);

test("Video readiness migration is additive and binds review/approval to exact lock", () => {
  assert.match(sql, /alter table public\.persona_personas/i);
  assert.match(sql, /video_identity_review_id/i);
  assert.match(sql, /video_identity_ready_lock_snapshot_id/i);
  assert.match(sql, /video_use_approval_review_id/i);
  assert.match(
    sql,
    /foreign key \(video_identity_ready_lock_snapshot_id, workspace_id\)/i,
  );
  assert.match(sql, /record_persona_video_identity_review/i);
  assert.match(sql, /approve_persona_video_use/i);
  assert.match(sql, /persona_video_identity_review_event_fk/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  const schemaDdl = sql.split(/create or replace function/i)[0];
  assert.doesNotMatch(schemaDdl, /update\s+public\.persona_personas/i);
});

test("Persona owner UI exposes German human Video review and explicit use approval", () => {
  const ui = readFileSync("components/persona/persona-studio.tsx", "utf8");
  for (const text of [
    "Video-Identität prüfen",
    "Video-Identität bestätigen",
    "Prüfung ablehnen",
    "Für Video Studio freigeben",
    "Technische Details",
  ]) {
    assert.match(ui, new RegExp(text));
  }
  assert.doesNotMatch(ui, /autoApproveVideo|video_use_approved:\s*true/);
});
