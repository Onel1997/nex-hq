"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ReportReviewDialogAction = "approve" | "reject" | "revision";

interface ReportReviewDialogProps {
  open: boolean;
  action: ReportReviewDialogAction | null;
  title: string;
  description: string;
  noteLabel: string;
  notePlaceholder: string;
  confirmLabel: string;
  cancelLabel: string;
  note: string;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  showNoteField?: boolean;
}

export function ReportReviewDialog({
  open,
  action,
  title,
  description,
  noteLabel,
  notePlaceholder,
  confirmLabel,
  cancelLabel,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
  isSubmitting,
  showNoteField = false,
}: ReportReviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, onCancel]);

  if (!open || !action) {
    return null;
  }

  const confirmVariant =
    action === "reject" ? "destructive" : action === "approve" ? "default" : "secondary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        aria-label={cancelLabel}
        disabled={isSubmitting}
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-review-dialog-title"
        aria-describedby="report-review-dialog-description"
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl",
          "luxury-surface",
        )}
      >
        <div className="space-y-2">
          <h2
            id="report-review-dialog-title"
            className="font-display text-xl font-medium"
          >
            {title}
          </h2>
          <p
            id="report-review-dialog-description"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {description}
          </p>
        </div>

        {showNoteField && (
          <div className="mt-5 space-y-2">
            <Label htmlFor="report-review-note">{noteLabel}</Label>
            <textarea
              id="report-review-note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={notePlaceholder}
              rows={3}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
