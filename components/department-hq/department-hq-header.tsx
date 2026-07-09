"use client";

import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import type { DepartmentHqHeaderConfig } from "./types";

interface DepartmentHqHeaderProps extends DepartmentHqHeaderConfig {
  className?: string;
}

export function DepartmentHqHeader({
  title,
  subtitle,
  statusLabel,
  statusLine,
  className,
}: DepartmentHqHeaderProps) {
  return (
    <header className={cn("dhq-header", className)}>
      <div className="dhq-header-copy">
        <p className="dhq-header-eyebrow">{subtitle}</p>
        <h1 className="dhq-header-title">{title}</h1>
        <p className="dhq-header-status-line">{statusLine}</p>
      </div>
      <div className="dhq-header-badge">
        <Activity className="size-3.5" />
        <span>{statusLabel}</span>
        <span className="dhq-header-badge-pulse" aria-hidden />
      </div>
    </header>
  );
}
