/**
 * Read-only incident audit — no generation, no deletes.
 * Usage: node scripts/audit-persona-incident.mjs [projectId]
 */
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID =
  process.argv[2] ?? "f04d43f3-1a74-436d-a458-8e23658eebf1";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const db = createClient(url, key);
const mask = (t) => (t ? `${String(t).slice(0, 8)}…${String(t).slice(-4)}` : null);

const { data: project, error: pErr } = await db
  .from("persona_creation_projects")
  .select("*")
  .eq("id", PROJECT_ID)
  .single();
if (pErr) throw pErr;

const { data: jobs } = await db
  .from("persona_generation_jobs")
  .select("*")
  .eq("creation_project_id", PROJECT_ID)
  .order("created_at", { ascending: false });

const { data: confirmations } = await db
  .from("persona_generation_confirmations")
  .select("*")
  .eq("creation_project_id", PROJECT_ID)
  .order("created_at", { ascending: false });

const { data: candidates } = await db
  .from("persona_candidates")
  .select("*")
  .eq("creation_project_id", PROJECT_ID)
  .order("created_at", { ascending: false });

const candidateIds = (candidates ?? []).map((c) => c.id);
let assets = [];
if (candidateIds.length) {
  const { data: a } = await db
    .from("persona_candidate_assets")
    .select(
      "id,candidate_id,asset_type,status,storage_path,file_size_bytes,created_at,generation_metadata",
    )
    .in("candidate_id", candidateIds)
    .order("created_at", { ascending: false });
  assets = a ?? [];
}

const { data: events } = await db
  .from("brain_events")
  .select("id,event_type,record_id,actor_id,created_at,payload")
  .eq("domain", "persona_studio")
  .order("created_at", { ascending: false })
  .limit(50);

const relevantEvents = (events ?? []).filter(
  (e) =>
    e.record_id === PROJECT_ID ||
    candidateIds.includes(e.record_id) ||
    (jobs ?? []).some((j) => j.id === e.record_id),
);

console.log(
  JSON.stringify(
    {
      audited_at: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        generation_stage: project.generation_stage,
        provider_mode: project.provider_mode,
        quality_mode: project.quality_mode,
        candidate_count: project.candidate_count,
        estimated_cost_min: project.estimated_cost_min,
        estimated_cost_max: project.estimated_cost_max,
        actual_cost: project.actual_cost,
        cost_confirmed_at: project.cost_confirmed_at,
        last_estimate_at: project.last_estimate_at,
        last_confirmation_token: mask(project.last_confirmation_token),
        created_by: project.created_by,
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
      jobs: (jobs ?? []).map((j) => ({
        id: j.id,
        status: j.status,
        stage: j.stage,
        provider: j.provider,
        provider_job_id: j.provider_job_id,
        quality_mode: j.quality_mode,
        requested_asset_types: j.requested_asset_types,
        estimated_cost_min: j.estimated_cost_min,
        estimated_cost_max: j.estimated_cost_max,
        actual_cost: j.actual_cost,
        cost_is_estimated: j.cost_is_estimated,
        confirmation_token: mask(j.confirmation_token),
        estimate_hash_prefix: j.estimate_hash?.slice(0, 16),
        confirmed_at: j.confirmed_at,
        started_at: j.started_at,
        completed_at: j.completed_at,
        error_code: j.error_code,
        error_message: j.error_message,
        created_by: j.created_by,
        created_at: j.created_at,
        confirmation_payload: j.confirmation_payload,
      })),
      confirmations: (confirmations ?? []).map((c) => ({
        id: c.id,
        generation_job_id: c.generation_job_id,
        confirmation_token: mask(c.confirmation_token),
        estimate_hash_prefix: c.estimate_hash?.slice(0, 16),
        stage: c.stage,
        quality_mode: c.quality_mode,
        candidate_count: c.candidate_count,
        asset_count: c.asset_count,
        estimated_cost_min: c.estimated_cost_min,
        estimated_cost_max: c.estimated_cost_max,
        confirmed_at: c.confirmed_at,
        consumed_at: c.consumed_at,
        created_by: c.created_by,
        created_at: c.created_at,
      })),
      candidates: (candidates ?? []).map((c) => ({
        id: c.id,
        candidate_number: c.candidate_number,
        status: c.status,
        provider: c.provider,
        provider_job_id: c.provider_job_id,
        actual_generation_cost: c.actual_generation_cost,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
      assets: assets.map((a) => ({
        id: a.id,
        candidate_id: a.candidate_id,
        asset_type: a.asset_type,
        status: a.status,
        storage_tail: String(a.storage_path ?? "").split("/").slice(-3).join("/"),
        file_size_bytes: a.file_size_bytes,
        created_at: a.created_at,
        generation_metadata: a.generation_metadata,
      })),
      audit_events: relevantEvents.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        record_id: e.record_id,
        actor_id: e.actor_id,
        created_at: e.created_at,
        payload: e.payload,
      })),
      summary: {
        job_count: jobs?.length ?? 0,
        confirmation_count: confirmations?.length ?? 0,
        candidate_count: candidates?.length ?? 0,
        asset_count: assets.length,
        ready_assets: assets.filter((a) => a.status === "ready").length,
      },
    },
    null,
    2,
  ),
);
