"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DepartmentHqPanelProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  side?: "left" | "right";
}

export function DepartmentHqPanel({
  title,
  icon: Icon,
  children,
  className,
  side = "left",
}: DepartmentHqPanelProps) {
  return (
    <aside
      className={cn(
        "dhq-panel",
        side === "left" ? "dhq-panel-left" : "dhq-panel-right",
        className,
      )}
    >
      <header className="dhq-panel-header">
        <Icon className="size-4" />
        <h2>{title}</h2>
      </header>
      <div className="dhq-panel-body">{children}</div>
    </aside>
  );
}
