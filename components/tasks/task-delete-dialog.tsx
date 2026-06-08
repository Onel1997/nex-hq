"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function TaskDeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isSubmitting,
}: TaskDeleteDialogProps) {
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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl",
          "luxury-surface",
        )}
      >
        <div className="space-y-2">
          <h2 className="font-display text-xl font-medium">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
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
            variant="destructive"
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
