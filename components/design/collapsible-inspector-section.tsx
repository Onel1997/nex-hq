"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

interface CollapsibleInspectorSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  compact?: boolean;
}

export function CollapsibleInspectorSection({
  id,
  title,
  icon: Icon,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  compact = true,
}: CollapsibleInspectorSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;

  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <section
      className={cn("ma-inspector-section", compact && "is-compact", open && "is-open")}
      aria-labelledby={id}
    >
      <button
        type="button"
        id={id}
        className="ma-inspector-head ma-inspector-toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="ma-inspector-head-leading">
          <Icon className="size-3.5" />
          <h3>{title}</h3>
        </span>
        <ChevronDown className={cn("ma-inspector-chevron", open && "is-open")} />
      </button>
      {open ? (
        <div className="ma-inspector-body ma-inspector-body--animated">{children}</div>
      ) : null}
    </section>
  );
}
