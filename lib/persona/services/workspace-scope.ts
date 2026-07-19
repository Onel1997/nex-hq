/**
 * Resolve active workspace scope for Persona Studio (same model as Brain/Tasks).
 */

import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { WorkspaceScope } from "../domain/types";

export async function resolvePersonaWorkspaceScope(): Promise<WorkspaceScope> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  let actorId: string | null = "workspace-user";

  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      actorId = data.user.id;
    }
  } catch {
    // Auth optional in local/dev — fall back to workspace-user (matches Tasks).
  }

  return {
    workspaceId: workspace.id,
    actorId,
  };
}
