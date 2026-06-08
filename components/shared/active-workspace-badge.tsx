"use client";

import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ActiveWorkspaceBadgeProps {
  className?: string;
}

export function ActiveWorkspaceBadge({ className }: ActiveWorkspaceBadgeProps) {
  const t = useT();
  const workspace = useWorkspace();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card/40 px-4 py-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      {t("dashboard.command.activeWorkspace", { workspace: workspace.name })}
    </span>
  );
}
