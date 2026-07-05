"use client";

import { cn } from "@/lib/utils";
import { CloudOff, Loader2 } from "lucide-react";

interface MockModeBadgeProps {
  active: boolean;
  probing?: boolean;
  className?: string;
}

export function MockModeBadge({ active, probing, className }: MockModeBadgeProps) {
  if (!active && !probing) return null;

  return (
    <span
      className={cn(
        "ds-mock-badge",
        active && "is-active",
        probing && !active && "is-probing",
        className,
      )}
      title={
        active
          ? "Design Studio is running with local mock data because the backend is offline."
          : "Checking backend connectivity…"
      }
    >
      {probing && !active ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <CloudOff className="size-3" aria-hidden />
      )}
      {active ? "Mock Mode — Backend Offline" : "Checking backend…"}
    </span>
  );
}
