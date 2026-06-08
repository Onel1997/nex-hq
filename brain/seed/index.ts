import { getBrainClient } from "@/brain/client";
import { HQ_INDUSTRY_PACKS } from "@/brain/platform/industries";
import type { BrainWorkspacesRow } from "@/brain/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { MILAENE_WORKSPACE_SLUG } from "@/lib/constants/workspace";
import { MILAENE_SEED_RECORDS } from "./milaene-data";

export interface WorkspaceContext {
  workspace: BrainWorkspacesRow;
  seeded: boolean;
}

/**
 * Resolve or create the Milaene workspace.
 */
export async function getOrCreateMilaeneWorkspace(): Promise<BrainWorkspacesRow> {
  const db = createAdminClient();
  const fashionPack = HQ_INDUSTRY_PACKS.fashion_hq;

  const { data: existing } = await db
    .from("brain_workspaces")
    .select()
    .eq("slug", MILAENE_WORKSPACE_SLUG)
    .maybeSingle();

  if (existing) {
    return existing as BrainWorkspacesRow;
  }

  const { data: created, error } = await db
    .from("brain_workspaces")
    .insert({
      slug: MILAENE_WORKSPACE_SLUG,
      name: "Milaene",
      industry_id: fashionPack.id,
      active_modules: fashionPack.availableModules,
      enabled_domains: [
        "company_profile",
        "decisions",
        "tasks",
        "reports",
        ...fashionPack.domains,
      ],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create Milaene workspace: ${error.message}`);
  }

  return created as BrainWorkspacesRow;
}

/**
 * Seed starter Brain records for Milaene if they don't exist.
 * Idempotent — skips records that already exist by slug.
 */
export async function ensureMilaeneBrainSeeded(): Promise<WorkspaceContext> {
  const workspace = await getOrCreateMilaeneWorkspace();
  const brain = getBrainClient();
  let seeded = false;

  for (const seed of MILAENE_SEED_RECORDS) {
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
