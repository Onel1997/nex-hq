"use client";

import { useCallback, useState } from "react";
import type { ReportReviewDialogAction } from "@/components/reports/report-review-dialog";
import { ReportReviewDialog } from "@/components/reports/report-review-dialog";
import { Button } from "@/components/ui/button";
import type { ReportReviewStatus } from "@/lib/mock/reports";
import { useDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Check, Loader2, RotateCcw, X } from "lucide-react";

interface ReportReviewActionsProps {
  brainRecordId: string;
  status: ReportReviewStatus;
  onReviewComplete: () => void | Promise<void>;
  onError?: (message: string) => void;
  className?: string;
}

export function ReportReviewActions({
  brainRecordId,
  status,
  onReviewComplete,
  onError,
  className,
}: ReportReviewActionsProps) {
  const { reports: reportsCopy } = useDictionary();
  const reviewCopy = reportsCopy.hub.review;

  const [pendingAction, setPendingAction] =
    useState<ReportReviewDialogAction | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canReview = status === "pending_review";

  const closeDialog = useCallback(() => {
    if (isSubmitting) return;
    setPendingAction(null);
    setNote("");
  }, [isSubmitting]);

  const submitReview = useCallback(async () => {
    if (!pendingAction) return;

    setIsSubmitting(true);

    try {
      const endpoint =
        pendingAction === "approve"
          ? "approve"
          : pendingAction === "reject"
            ? "reject"
            : "revision";

      const res = await fetch(`/api/reports/${brainRecordId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          note.trim() ? { note: note.trim() } : {},
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? reviewCopy.error);
      }

      closeDialog();
      await onReviewComplete();
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : reviewCopy.error,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    brainRecordId,
    closeDialog,
    note,
    onError,
    onReviewComplete,
    pendingAction,
    reviewCopy.error,
  ]);

  const dialogCopy =
    pendingAction === "approve"
      ? {
          title: reviewCopy.confirmApproveTitle,
          description: reviewCopy.confirmApproveDescription,
          showNoteField: false,
        }
      : pendingAction === "reject"
        ? {
            title: reviewCopy.confirmRejectTitle,
            description: reviewCopy.confirmRejectDescription,
            showNoteField: true,
          }
        : pendingAction === "revision"
          ? {
              title: reviewCopy.confirmRevisionTitle,
              description: reviewCopy.confirmRevisionDescription,
              showNoteField: true,
            }
          : {
              title: "",
              description: "",
              showNoteField: false,
            };

  if (!canReview) {
    return null;
  }

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => setPendingAction("approve")}
          disabled={isSubmitting}
        >
          {isSubmitting && pendingAction === "approve" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {reviewCopy.approve}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setPendingAction("revision")}
          disabled={isSubmitting}
        >
          <RotateCcw className="size-4" />
          {reviewCopy.requestRevision}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={() => setPendingAction("reject")}
          disabled={isSubmitting}
        >
          <X className="size-4" />
          {reviewCopy.reject}
        </Button>
      </div>

      <ReportReviewDialog
        open={pendingAction !== null}
        action={pendingAction}
        title={dialogCopy.title}
        description={dialogCopy.description}
        noteLabel={reviewCopy.noteLabel}
        notePlaceholder={reviewCopy.notePlaceholder}
        confirmLabel={reviewCopy.confirm}
        cancelLabel={reviewCopy.cancel}
        note={note}
        onNoteChange={setNote}
        onConfirm={submitReview}
        onCancel={closeDialog}
        isSubmitting={isSubmitting}
        showNoteField={dialogCopy.showNoteField}
      />
    </>
  );
}
