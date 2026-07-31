/**
 * Persist non-sensitive live evaluation evidence so refresh does not erase results.
 * Never stores embedding vectors, image bytes, or signed URLs.
 */

import type { SafeFaceNoveltyLiveDebug } from "./live-debug";
import { buildSafeFaceNoveltyLiveDebug } from "./live-debug";

export type LiveEvaluationEvidence = SafeFaceNoveltyLiveDebug;

export interface LiveDiagnosticStore {
  saveEvidence(
    noveltyRecordId: string,
    workspaceId: string,
    evidence: LiveEvaluationEvidence,
  ): Promise<void>;
  loadEvidence(
    noveltyRecordId: string,
    workspaceId: string,
  ): Promise<LiveEvaluationEvidence | null>;
  loadEvidenceForProject(
    workspaceId: string,
    creationProjectId: string,
  ): Promise<LiveEvaluationEvidence[]>;
}

/** In-memory diagnostic store for tests. */
export class MemoryLiveDiagnosticStore implements LiveDiagnosticStore {
  private readonly byRecord = new Map<string, LiveEvaluationEvidence & { workspaceId: string; projectId?: string }>();

  async saveEvidence(
    noveltyRecordId: string,
    workspaceId: string,
    evidence: LiveEvaluationEvidence,
  ): Promise<void> {
    const safe = buildSafeFaceNoveltyLiveDebug(evidence);
    this.byRecord.set(noveltyRecordId, {
      ...safe,
      workspaceId,
      projectId: evidence.candidateProjectId,
    });
  }

  async loadEvidence(
    noveltyRecordId: string,
    workspaceId: string,
  ): Promise<LiveEvaluationEvidence | null> {
    const row = this.byRecord.get(noveltyRecordId);
    if (!row || row.workspaceId !== workspaceId) return null;
    const { workspaceId: _w, projectId: _p, ...evidence } = row;
    return evidence;
  }

  async loadEvidenceForProject(
    workspaceId: string,
    creationProjectId: string,
  ): Promise<LiveEvaluationEvidence[]> {
    const out: LiveEvaluationEvidence[] = [];
    for (const row of this.byRecord.values()) {
      if (row.workspaceId !== workspaceId) continue;
      if (row.projectId !== creationProjectId && row.candidateProjectId !== creationProjectId) {
        continue;
      }
      const { workspaceId: _w, projectId: _p, ...evidence } = row;
      out.push(evidence);
    }
    return out;
  }
}
