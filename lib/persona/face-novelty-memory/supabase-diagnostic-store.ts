/**
 * Supabase-backed live diagnostic store — persists SafeFaceNoveltyLiveDebug
 * on persona_face_novelty_records.live_evaluation_evidence.
 * Never writes embedding vectors into this column.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import {
  buildSafeFaceNoveltyLiveDebug,
  type SafeFaceNoveltyLiveDebug,
} from "./live-debug";
import type { LiveDiagnosticStore, LiveEvaluationEvidence } from "./diagnostic-store";

const TABLE = "persona_face_novelty_records";

function throwDb(error: { message: string } | null, msg: string) {
  if (error) throw new PersonaDomainError(msg, "VALIDATION", { message: error.message });
}

export class SupabaseLiveDiagnosticStore implements LiveDiagnosticStore {
  async saveEvidence(
    noveltyRecordId: string,
    workspaceId: string,
    evidence: LiveEvaluationEvidence,
  ): Promise<void> {
    const safe = buildSafeFaceNoveltyLiveDebug(evidence);
    const client = createAdminClient();
    const { error } = await client
      .from(TABLE)
      .update({ live_evaluation_evidence: safe })
      .eq("id", noveltyRecordId)
      .eq("workspace_id", workspaceId);
    throwDb(error, "Failed to save live evaluation evidence");
  }

  async loadEvidence(
    noveltyRecordId: string,
    workspaceId: string,
  ): Promise<LiveEvaluationEvidence | null> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(TABLE)
      .select("live_evaluation_evidence")
      .eq("id", noveltyRecordId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    throwDb(error, "Failed to load live evaluation evidence");
    if (!data?.live_evaluation_evidence) return null;
    return buildSafeFaceNoveltyLiveDebug(
      data.live_evaluation_evidence as SafeFaceNoveltyLiveDebug,
    );
  }

  async loadEvidenceForProject(
    workspaceId: string,
    creationProjectId: string,
  ): Promise<LiveEvaluationEvidence[]> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(TABLE)
      .select("live_evaluation_evidence")
      .eq("workspace_id", workspaceId)
      .eq("creation_project_id", creationProjectId);
    throwDb(error, "Failed to load project live evaluation evidence");
    const out: LiveEvaluationEvidence[] = [];
    for (const row of data ?? []) {
      const ev = (row as { live_evaluation_evidence?: unknown }).live_evaluation_evidence;
      if (!ev || typeof ev !== "object") continue;
      out.push(buildSafeFaceNoveltyLiveDebug(ev as SafeFaceNoveltyLiveDebug));
    }
    return out;
  }
}
