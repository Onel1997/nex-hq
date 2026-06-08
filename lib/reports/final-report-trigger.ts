import { runCeoFinalReport } from "@/agents/ceo/final-report";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import {
  buildGoalSynthesisContext,
  isGoalReadyForFinalSynthesis,
  resolveParentGoalFromApprovedReport,
} from "@/lib/reports/goal-synthesis";

export interface FinalReportTriggerResult {
  triggered: boolean;
  parentGoalTaskId?: string;
  reportId?: string;
  reportRecordId?: string;
  reason?: string;
}

/**
 * After a specialist report is approved, check if CEO final synthesis should run.
 */
export async function maybeTriggerCeoFinalReport(
  approvedReportBrainRecordId: string,
): Promise<FinalReportTriggerResult> {
  const parentGoalTaskId = await resolveParentGoalFromApprovedReport(
    approvedReportBrainRecordId,
  );

  if (!parentGoalTaskId) {
    return { triggered: false, reason: "no_parent_goal" };
  }

  const ready = await isGoalReadyForFinalSynthesis(parentGoalTaskId);
  if (!ready) {
    return {
      triggered: false,
      parentGoalTaskId,
      reason: "not_all_required_reports_approved",
    };
  }

  const context = await buildGoalSynthesisContext(parentGoalTaskId);
  if (!context) {
    return { triggered: false, reason: "context_build_failed" };
  }

  const { workspace } = await ensureWorkspaceBrainSeeded();

  console.info("[CEO Final Trigger] Starting synthesis", {
    parentGoalTaskId,
    research: context.researchReports.length,
    design: context.designReports.length,
    marketing: context.marketingReports.length,
  });

  try {
    const result = await runCeoFinalReport({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      parentGoalTaskId,
      founderGoal: context.founderGoal,
      childTaskIds: context.childTaskIds,
      researchReports: context.researchReports,
      designReports: context.designReports,
      marketingReports: context.marketingReports,
    });

    return {
      triggered: true,
      parentGoalTaskId,
      reportId: result.reportId,
      reportRecordId: result.reportRecordId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Final report synthesis failed";
    console.error("[CEO Final Trigger] Failed", { parentGoalTaskId, message });
    return {
      triggered: false,
      parentGoalTaskId,
      reason: message,
    };
  }
}
