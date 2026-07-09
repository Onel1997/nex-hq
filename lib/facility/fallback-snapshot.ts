import { getActiveWorkspace } from "@/lib/workspace/active";
import { deriveCeoCoreState } from "@/lib/facility/derive-ceo-state";
import { deriveLabSnapshots } from "@/lib/facility/derive-lab-state";
import type { FacilitySnapshot } from "@/lib/facility/types";

/** Local/demo facility snapshot when cloud Brain or provider quota is unavailable. */
export function buildFallbackFacilitySnapshot(): FacilitySnapshot {
  const workspaceConfig = getActiveWorkspace();
  const labs = deriveLabSnapshots([], []);
  const ceo = deriveCeoCoreState(labs.ceo, [], []);

  return {
    workspace: {
      id: `local-${workspaceConfig.slug}`,
      name: workspaceConfig.name,
    },
    telemetry: {
      live: false,
      activeExecutions: 0,
      pendingReview: 0,
      completedToday: 0,
      failedTasks: 0,
    },
    brain: {
      totalTasks: 0,
      totalReports: 0,
      activeExecutions: 0,
      completionPct: 0,
      knowledge: {
        reports: 0,
        designs: 0,
        campaigns: 0,
        collections: 0,
        activeAgents: 0,
      },
    },
    ceo,
    labs,
    reviewQueue: [],
    events: [],
    goal: null,
    refreshedAt: new Date().toISOString(),
  };
}

export function isLocalWorkspaceId(workspaceId: string): boolean {
  return workspaceId.startsWith("local-");
}
