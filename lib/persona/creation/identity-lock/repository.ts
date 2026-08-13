/**
 * Phase 2.4A — Identity lock snapshot repository.
 */

import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  CreateIdentityLockSnapshotInput,
  PersonaIdentityLockSnapshot,
} from "./types";
import { SupabaseIdentityLockRepository } from "./supabase-repository";

export interface IdentityLockRepository {
  readonly kind: "memory" | "supabase";
  createSnapshot(
    scope: WorkspaceScope,
    input: CreateIdentityLockSnapshotInput,
  ): Promise<PersonaIdentityLockSnapshot>;
  getLatestSnapshotForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaIdentityLockSnapshot | null>;
  getSnapshotByVersion(
    scope: WorkspaceScope,
    personaId: string,
    lockVersion: number,
  ): Promise<PersonaIdentityLockSnapshot | null>;
}

export class MemoryIdentityLockRepository implements IdentityLockRepository {
  readonly kind = "memory" as const;
  private snapshots = new Map<string, PersonaIdentityLockSnapshot>();

  async createSnapshot(
    scope: WorkspaceScope,
    input: CreateIdentityLockSnapshotInput,
  ): Promise<PersonaIdentityLockSnapshot> {
    const now = new Date().toISOString();
    const row: PersonaIdentityLockSnapshot = {
      id: randomUUID(),
      created_at: now,
      ...input,
      workspace_id: scope.workspaceId,
    };
    this.snapshots.set(row.id, row);
    return { ...row };
  }

  async getLatestSnapshotForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaIdentityLockSnapshot | null> {
    const rows = [...this.snapshots.values()]
      .filter(
        (s) => s.workspace_id === scope.workspaceId && s.persona_id === personaId,
      )
      .sort((a, b) => b.identity_lock_version - a.identity_lock_version);
    return rows[0] ? { ...rows[0] } : null;
  }

  async getSnapshotByVersion(
    scope: WorkspaceScope,
    personaId: string,
    lockVersion: number,
  ): Promise<PersonaIdentityLockSnapshot | null> {
    const row = [...this.snapshots.values()].find(
      (s) =>
        s.workspace_id === scope.workspaceId &&
        s.persona_id === personaId &&
        s.identity_lock_version === lockVersion,
    );
    return row ? { ...row } : null;
  }
}

let testOverride: IdentityLockRepository | null = null;
let singletonMemory: MemoryIdentityLockRepository | null = null;

export function setIdentityLockRepositoryForTests(
  repo: IdentityLockRepository | null,
): void {
  testOverride = repo;
}

export function getIdentityLockRepository(): IdentityLockRepository {
  if (testOverride) return testOverride;
  if (isSupabaseConfigured()) {
    return new SupabaseIdentityLockRepository();
  }
  if (!singletonMemory) {
    singletonMemory = new MemoryIdentityLockRepository();
  }
  return singletonMemory;
}
