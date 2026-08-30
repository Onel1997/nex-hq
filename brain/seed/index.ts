import { getBrainClient } from "@/brain/client";
import { HQ_INDUSTRY_PACKS } from "@/brain/platform/industries";
import type { BrainWorkspacesRow } from "@/brain/schema";
import { getWorkspaceConfig } from "@/brain/workspaces";
import type { WorkspaceDefinition } from "@/brain/workspaces/types";
import { isRecoverableWorkspaceError } from "@/lib/providers/provider-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";

export interface WorkspaceContext {
  workspace: BrainWorkspacesRow;
  seeded: boolean;
}

const WORKSPACE_CACHE_TTL_MS = 60_000;
const workspaceCache = new Map<
  string,
  { expiresAt: number; promise: Promise<BrainWorkspacesRow> }
>();
const seedPromises = new Map<string, Promise<WorkspaceContext>>();

function buildLocalWorkspaceRow(config: WorkspaceDefinition): BrainWorkspacesRow {
  const industryPack = HQ_INDUSTRY_PACKS[config.industryId];
  const now = new Date().toISOString();
  return {
    id: `local-${config.slug}`,
    slug: config.slug,
    name: config.name,
    industry_id: industryPack.id,
    active_modules: industryPack.availableModules,
    enabled_domains: [
      "company_profile",
      "decisions",
      "tasks",
      "reports",
      ...industryPack.domains,
    ],
    created_at: now,
    updated_at: now,
  };
}

function isLocalWorkspace(workspace: BrainWorkspacesRow): boolean {
  return workspace.id.startsWith("local-");
}

/**
 * Resolve or create a workspace from its configuration.
 */
export async function getOrCreateWorkspace(
  slug: string,
): Promise<BrainWorkspacesRow> {
  const config = getWorkspaceConfig(slug);

  try {
    const db = createAdminClient();
    const industryPack = HQ_INDUSTRY_PACKS[config.industryId];

    const { data: existing } = await db
      .from("brain_workspaces")
      .select()
      .eq("slug", config.slug)
      .maybeSingle();

    if (existing) {
      return existing as BrainWorkspacesRow;
    }

    const { data: created, error } = await db
      .from("brain_workspaces")
      .insert({
        slug: config.slug,
        name: config.name,
        industry_id: industryPack.id,
        active_modules: industryPack.availableModules,
        enabled_domains: [
          "company_profile",
          "decisions",
          "tasks",
          "reports",
          ...industryPack.domains,
        ],
      })
      .select()
      .single();

    if (error) {
      if (isRecoverableWorkspaceError(error)) {
        console.warn(
          `[Brain] Using local workspace fallback for "${config.slug}": ${error.message}`,
        );
        return buildLocalWorkspaceRow(config);
      }
      throw new Error(`Failed to create workspace "${config.slug}": ${error.message}`);
    }

    return created as BrainWorkspacesRow;
  } catch (error) {
    if (isRecoverableWorkspaceError(error)) {
      console.warn(
        `[Brain] Using local workspace fallback for "${config.slug}":`,
        error,
      );
      return buildLocalWorkspaceRow(config);
    }
    throw error;
  }
}

/**
 * Resolve the configured workspace without inspecting or writing seed records.
 * Concurrent requests share one bounded promise; failures are never cached.
 */
export async function resolveWorkspace(slug?: string): Promise<BrainWorkspacesRow> {
  const workspaceSlug = slug ?? getActiveWorkspaceSlug();
  const now = Date.now();
  const cached = workspaceCache.get(workspaceSlug);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = getOrCreateWorkspace(workspaceSlug).catch((error) => {
    if (workspaceCache.get(workspaceSlug)?.promise === promise) {
      workspaceCache.delete(workspaceSlug);
    }
    throw error;
  });
  workspaceCache.set(workspaceSlug, {
    expiresAt: now + WORKSPACE_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

/**
 * Seed starter Brain records for a workspace if they don't exist.
 * Idempotent — skips records that already exist by slug.
 */
export async function ensureWorkspaceBrainSeeded(
  slug?: string,
): Promise<WorkspaceContext> {
  const workspaceSlug = slug ?? getActiveWorkspaceSlug();
  const inFlightOrComplete = seedPromises.get(workspaceSlug);
  if (inFlightOrComplete) return inFlightOrComplete;

  const promise = seedWorkspaceBrain(workspaceSlug).catch((error) => {
    if (seedPromises.get(workspaceSlug) === promise) {
      seedPromises.delete(workspaceSlug);
    }
    throw error;
  });
  seedPromises.set(workspaceSlug, promise);
  return promise;
}

async function seedWorkspaceBrain(workspaceSlug: string): Promise<WorkspaceContext> {
  const config = getWorkspaceConfig(workspaceSlug);
  const workspace = await resolveWorkspace(workspaceSlug);

  if (isLocalWorkspace(workspace)) {
    return { workspace, seeded: false };
  }

  const brain = getBrainClient();
  let seeded = false;

  for (const seed of config.seedRecords) {
    try {
      const existing = await brain.recordExistsBySlug(
        workspace.id,
        seed.domain,
        seed.slug,
      );

      if (existing) continue;

      await brain.createRecord({
        workspaceId: workspace.id,
        domain: seed.domain,
        slug: seed.slug,
        title: seed.title,
        summary: seed.summary,
        content: seed.content,
        status: "approved",
        tags: seed.tags,
        provenance: {
          createdBy: { type: "system", id: "seed" },
        },
      });

      seeded = true;
    } catch (error) {
      if (isRecoverableWorkspaceError(error)) {
        console.warn(
          `[Brain] Skipping seed record "${seed.slug}" in local fallback mode`,
        );
        continue;
      }
      throw error;
    }
  }

  return { workspace, seeded };
}

/** Provision a workspace row without seeding records. */
export async function provisionWorkspace(
  config: WorkspaceDefinition,
): Promise<BrainWorkspacesRow> {
  return getOrCreateWorkspace(config.slug);
}

/** Test-only cache reset; no production request calls this. */
export function clearWorkspaceResolutionCacheForTests(): void {
  workspaceCache.clear();
  seedPromises.clear();
}
