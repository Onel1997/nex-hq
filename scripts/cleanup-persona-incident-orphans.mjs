/**
 * Cancel orphan pending_confirmation jobs and expire unused tokens.
 * Preserves completed incident evidence — never deletes rows.
 *
 * Usage: node --env-file=.env.local scripts/cleanup-persona-incident-orphans.mjs [projectId]
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
const nowIso = new Date().toISOString();
const CANCEL_CODE = "incident_cleanup_unused_confirmation";

const { data: project, error: pErr } = await db
  .from("persona_creation_projects")
  .select("id, workspace_id, name")
  .eq("id", PROJECT_ID)
  .single();
if (pErr) throw pErr;

const { data: jobs } = await db
  .from("persona_generation_jobs")
  .select("*")
  .eq("creation_project_id", PROJECT_ID);

const { data: confirmations } = await db
  .from("persona_generation_confirmations")
  .select("*")
  .eq("creation_project_id", PROJECT_ID);

const completedJobIds = new Set(
  (jobs ?? [])
    .filter((j) => ["completed", "partially_completed", "failed"].includes(j.status))
    .map((j) => j.id),
);

const orphanJobs = (jobs ?? []).filter((j) => j.status === "pending_confirmation");
const orphanJobIds = new Set(orphanJobs.map((j) => j.id));
const orphanTokens = new Set(
  orphanJobs.map((j) => j.confirmation_token).filter(Boolean),
);

let jobsCancelled = 0;
for (const job of orphanJobs) {
  const { error } = await db
    .from("persona_generation_jobs")
    .update({
      status: "cancelled",
      cancelled_at: nowIso,
      error_code: CANCEL_CODE,
      error_message: "Unbenutzte Debug-Bestätigung — kein Provider-Aufruf.",
      updated_at: nowIso,
    })
    .eq("id", job.id);
  if (error) throw error;
  jobsCancelled += 1;
}

const confirmationsToExpire = (confirmations ?? []).filter((c) => {
  if (c.consumed_at) return false;
  const payload = c.payload ?? {};
  if (payload.incident_cleanup?.status === "cancelled") return false;
  if (c.generation_job_id && completedJobIds.has(c.generation_job_id)) return false;
  if (c.generation_job_id && orphanJobIds.has(c.generation_job_id)) return true;
  if (orphanTokens.has(c.confirmation_token)) return true;
  return false;
});

let confirmationsExpired = 0;
for (const c of confirmationsToExpire) {
  const { error } = await db
    .from("persona_generation_confirmations")
    .update({
      consumed_at: nowIso,
      payload: {
        ...(c.payload ?? {}),
        expired: true,
        incident_cleanup: {
          status: "cancelled",
          reason: CANCEL_CODE,
          cancelled_at: nowIso,
        },
      },
    })
    .eq("id", c.id);
  if (error) throw error;
  confirmationsExpired += 1;
}

const completedJobs = (jobs ?? []).filter((j) =>
  ["completed", "partially_completed"].includes(j.status),
);
let jobsClassified = 0;
for (const job of completedJobs) {
  const payload = job.confirmation_payload ?? {};
  if (payload.incident_classification?.preserved) continue;
  const { error } = await db
    .from("persona_generation_jobs")
    .update({
      confirmation_payload: {
        ...payload,
        incident_classification: {
          type: "debug_unattested",
          label: "Debug-Lauf · nicht über die normale UI bestätigt",
          preserved: true,
          classified_at: nowIso,
        },
      },
      updated_at: nowIso,
    })
    .eq("id", job.id);
  if (error) throw error;
  jobsClassified += 1;
}

console.log(
  JSON.stringify(
    {
      cleaned_at: nowIso,
      project_id: PROJECT_ID,
      project_name: project.name,
      orphan_jobs_found: orphanJobs.length,
      orphan_jobs_cancelled: jobsCancelled,
      unused_confirmations_expired: confirmationsExpired,
      incident_jobs_classified: jobsClassified,
      preserved_completed_job_ids: completedJobs.map((j) => j.id),
    },
    null,
    2,
  ),
);
