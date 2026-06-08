import { getBrainClient } from "@/brain/client";
import { HQ_INDUSTRY_PACKS } from "@/brain/platform/industries";
import type { BrainWorkspacesRow } from "@/brain/schema";
import { getWorkspaceConfig } from "@/brain/workspaces";
import type { WorkspaceDefinition } from "@/brain/workspaces/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";

export interface WorkspaceContext {
  workspace: BrainWorkspacesRow;
  seeded: boolean;
}

/**
 * Resolve or create a workspace from its configuration.
 */
export async function getOrCreateWorkspace(
  slug: string,
): Promise<BrainWorkspacesRow> {
  const config = getWorkspaceConfig(slug);
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
    throw new Error(`Failed to create workspace "${config.slug}": ${error.message}`);
  }

  return created as BrainWorkspacesRow;
}

/**
 * Seed starter Brain records for a workspace if they don't exist.
 * Idempotent — skips records that already exist by slug.
 */
export async function ensureWorkspaceBrainSeeded(
  slug?: string,
): Promise<WorkspaceContext> {
  const workspaceSlug = slug ?? getActiveWorkspaceSlug();
  const config = getWorkspaceConfig(workspaceSlug);
  const workspace = await getOrCreateWorkspace(workspaceSlug);
  const brain = getBrainClient();
  let seeded = false;

  for (const seed of config.seedRecords) {
    const existing = await brain.getRecordBySlug(
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
  }

  return { workspace, seeded };
}

/** Provision a workspace row without seeding records. */
export async function provisionWorkspace(
  config: WorkspaceDefinition,
): Promise<BrainWorkspacesRow> {
  return getOrCreateWorkspace(config.slug);
}
