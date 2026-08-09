/**
 * In-memory Reference Package repository (tests).
 */

import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  CreateReferencePackageAttemptInput,
  CreateReferencePackageSessionInput,
  ReferencePackageAttempt,
  ReferencePackageSession,
  UpdateReferencePackageAttemptInput,
  UpdateReferencePackageSessionInput,
} from "./types";
import { SupabaseReferencePackageRepository } from "./supabase-repository";

export interface ReferencePackageRepository {
  readonly kind: "memory" | "supabase";
  createSession(
    scope: WorkspaceScope,
    input: CreateReferencePackageSessionInput,
  ): Promise<ReferencePackageSession>;
  getSession(
    scope: WorkspaceScope,
    id: string,
  ): Promise<ReferencePackageSession | null>;
  getLatestSessionForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferencePackageSession | null>;
  findSessionByToken(
    scope: WorkspaceScope,
    token: string,
  ): Promise<ReferencePackageSession | null>;
  updateSession(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferencePackageSessionInput,
  ): Promise<ReferencePackageSession>;
  createAttempt(
    scope: WorkspaceScope,
    input: CreateReferencePackageAttemptInput,
  ): Promise<ReferencePackageAttempt>;
  updateAttempt(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferencePackageAttemptInput,
  ): Promise<ReferencePackageAttempt>;
  listAttemptsForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferencePackageAttempt[]>;
  listAttemptsForSession(
    scope: WorkspaceScope,
    sessionId: string,
  ): Promise<ReferencePackageAttempt[]>;
}

export class MemoryReferencePackageRepository
  implements ReferencePackageRepository
{
  readonly kind = "memory" as const;
  private sessions = new Map<string, ReferencePackageSession>();
  private attempts = new Map<string, ReferencePackageAttempt>();

  async createSession(
    scope: WorkspaceScope,
    input: CreateReferencePackageSessionInput,
  ): Promise<ReferencePackageSession> {
    const now = new Date().toISOString();
    const row: ReferencePackageSession = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      persona_id: input.persona_id,
      master_reference_id: input.master_reference_id,
      status: "pending_confirmation",
      provider: "openai",
      confirmation_token: input.confirmation_token,
      estimate_hash: input.estimate_hash,
      estimated_cost_min: input.estimated_cost_min,
      estimated_cost_max: input.estimated_cost_max,
      max_authorized_spend: input.max_authorized_spend,
      image_count: input.image_count,
      confirmed_at: null,
      consumed_at: null,
      created_at: now,
      updated_at: now,
    };
    this.sessions.set(row.id, row);
    return { ...row };
  }

  async getSession(
    scope: WorkspaceScope,
    id: string,
  ): Promise<ReferencePackageSession | null> {
    const row = this.sessions.get(id);
    if (!row || row.workspace_id !== scope.workspaceId) return null;
    return { ...row };
  }

  async getLatestSessionForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferencePackageSession | null> {
    const rows = [...this.sessions.values()]
      .filter(
        (s) =>
          s.workspace_id === scope.workspaceId && s.persona_id === personaId,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows[0] ? { ...rows[0] } : null;
  }

  async findSessionByToken(
    scope: WorkspaceScope,
    token: string,
  ): Promise<ReferencePackageSession | null> {
    const row = [...this.sessions.values()].find(
      (s) =>
        s.workspace_id === scope.workspaceId &&
        s.confirmation_token === token,
    );
    return row ? { ...row } : null;
  }

  async updateSession(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferencePackageSessionInput,
  ): Promise<ReferencePackageSession> {
    const current = await this.getSession(scope, id);
    if (!current) throw new Error(`Session not found: ${id}`);
    const updated: ReferencePackageSession = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.sessions.set(id, updated);
    return { ...updated };
  }

  async createAttempt(
    scope: WorkspaceScope,
    input: CreateReferencePackageAttemptInput,
  ): Promise<ReferencePackageAttempt> {
    const now = new Date().toISOString();
    const row: ReferencePackageAttempt = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      persona_id: input.persona_id,
      session_id: input.session_id,
      master_reference_id: input.master_reference_id,
      reference_slot: input.reference_slot,
      effective_slot: null,
      reassigned_from: null,
      reassigned_at: null,
      reassigned_by: null,
      angle_review_source: null,
      angle_review_decision: null,
      provider: "openai",
      provider_request_id: null,
      generated_asset_id: null,
      status: input.status ?? "queued",
      identity_decision: null,
      identity_distance: null,
      identity_similarity: null,
      angle_direction: null,
      detected_orientation: null,
      detected_yaw_degrees: null,
      cost_eur: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };
    this.attempts.set(row.id, row);
    return { ...row };
  }

  async updateAttempt(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferencePackageAttemptInput,
  ): Promise<ReferencePackageAttempt> {
    const current = this.attempts.get(id);
    if (!current || current.workspace_id !== scope.workspaceId) {
      throw new Error(`Attempt not found: ${id}`);
    }
    const updated: ReferencePackageAttempt = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.attempts.set(id, updated);
    return { ...updated };
  }

  async listAttemptsForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferencePackageAttempt[]> {
    return [...this.attempts.values()]
      .filter(
        (a) =>
          a.workspace_id === scope.workspaceId && a.persona_id === personaId,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((a) => ({ ...a }));
  }

  async listAttemptsForSession(
    scope: WorkspaceScope,
    sessionId: string,
  ): Promise<ReferencePackageAttempt[]> {
    return [...this.attempts.values()]
      .filter(
        (a) =>
          a.workspace_id === scope.workspaceId && a.session_id === sessionId,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((a) => ({ ...a }));
  }
}

let testOverride: ReferencePackageRepository | null = null;
let singletonMemory: MemoryReferencePackageRepository | null = null;

export function setReferencePackageRepositoryForTests(
  repo: ReferencePackageRepository | null,
): void {
  testOverride = repo;
}

export function getReferencePackageRepository(): ReferencePackageRepository {
  if (testOverride) return testOverride;
  if (isSupabaseConfigured()) {
    return new SupabaseReferencePackageRepository();
  }
  if (!singletonMemory) {
    singletonMemory = new MemoryReferencePackageRepository();
  }
  return singletonMemory;
}
