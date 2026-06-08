import { getBrainClient } from "@/brain/client";
import type { BrainReportContent } from "@/brain/domains/reports";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainActor, BrainRecordStatus } from "@/brain/types";
import { brainReportRecordToListItem } from "@/lib/reports/from-brain";
import type { ReportStatus } from "@/reports/types";

export type ReportReviewAction = "approve" | "reject" | "revision";

export class ReportReviewError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_STATUS" | "CONFIG",
  ) {
    super(message);
    this.name = "ReportReviewError";
  }
}

const REVIEWABLE_RECORD_STATUSES: BrainRecordStatus[] = ["pending_review"];

const REVIEW_TRANSITIONS: Record<
  ReportReviewAction,
  {
    recordStatus: BrainRecordStatus;
    contentStatus: ReportStatus;
    eventType: "report.approved" | "report.rejected" | "report.revision_requested";
  }
> = {
  approve: {
    recordStatus: "approved",
    contentStatus: "approved",
    eventType: "report.approved",
  },
  reject: {
    recordStatus: "rejected",
    contentStatus: "rejected",
    eventType: "report.rejected",
  },
  revision: {
    recordStatus: "revision_requested",
    contentStatus: "revision_requested",
    eventType: "report.revision_requested",
  },
};

const HUMAN_REVIEWER: BrainActor = {
  type: "human",
  id: "workspace-user",
};

export interface ReviewReportOptions {
  note?: string;
}

export interface ReviewReportResult {
  report: ReturnType<typeof brainReportRecordToListItem>;
  brainRecordId: string;
  previousStatus: BrainRecordStatus;
  newStatus: BrainRecordStatus;
  reviewEventId: string;
}

export async function reviewReportRecord(
  brainRecordId: string,
  action: ReportReviewAction,
  options: ReviewReportOptions = {},
): Promise<ReviewReportResult> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const record = await brain.getRecord("reports", brainRecordId);

  if (!record || record.workspaceId !== workspace.id) {
    throw new ReportReviewError("Report not found", "NOT_FOUND");
  }

  if (!REVIEWABLE_RECORD_STATUSES.includes(record.status)) {
    throw new ReportReviewError(
      `Report cannot be reviewed in status "${record.status}"`,
      "INVALID_STATUS",
    );
  }

  const transition = REVIEW_TRANSITIONS[action];
  const previousStatus = record.status;
  const existingContent = record.content as BrainReportContent;
  const trimmedNote = options.note?.trim();

  const contentPatch: Partial<BrainReportContent> = {
    status: transition.contentStatus,
  };

  if (trimmedNote) {
    contentPatch.notes = trimmedNote;
  }

  const { record: updatedRecord } = await brain.updateRecord(
    "reports",
    brainRecordId,
    {
      status: transition.recordStatus,
      content: contentPatch,
    },
    HUMAN_REVIEWER,
  );

  const reviewEventId = await brain.logReportReviewEvent({
    workspaceId: workspace.id,
    recordId: brainRecordId,
    actor: HUMAN_REVIEWER,
    eventType: transition.eventType,
    payload: {
      action,
      previousStatus,
      newStatus: transition.recordStatus,
      previousContentStatus: existingContent.status,
      newContentStatus: transition.contentStatus,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    },
  });

  return {
    report: brainReportRecordToListItem(updatedRecord),
    brainRecordId,
    previousStatus,
    newStatus: transition.recordStatus,
    reviewEventId,
  };
}
