"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
  expandLabel?: string;
  collapseLabel?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  className,
  children,
  expandLabel = "Bereich öffnen",
  collapseLabel = "Bereich schließen",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("rs3-fusion-section rs3-fusion-collapsible", className)}>
      <button
        type="button"
        className="rs3-fusion-collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="rs3-fusion-section-head rs3-fusion-collapsible-head">
          {icon}
          <h3>{title}</h3>
        </span>
        <span className="rs3-fusion-collapsible-meta">
          <span className="rs3-fusion-collapsible-hint">
            {open ? collapseLabel : expandLabel}
          </span>
          <ChevronDown
            className={cn("rs3-fusion-collapsible-chevron", open && "rs3-fusion-collapsible-chevron-open")}
          />
        </span>
      </button>
      {open ? <div className="rs3-fusion-collapsible-body">{children}</div> : null}
    </section>
  );
}
