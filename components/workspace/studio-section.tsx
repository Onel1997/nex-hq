"use client";

import { StudioCard } from "@/components/workspace/studio-card";
import type { StudioSection } from "@/lib/workspace/agent-routes";
import { cn } from "@/lib/utils";

interface StudioSectionGridProps {
  section: StudioSection;
  itemCount?: number;
  children?: React.ReactNode;
  className?: string;
}

export function StudioSectionGrid({
  section,
  itemCount = 0,
  children,
  className,
}: StudioSectionGridProps) {
  return (
    <section className={cn("workspace-studio-section", className)}>
      <header className="workspace-studio-section-header">
        <h2 className="workspace-studio-section-title">{section.label}</h2>
        {itemCount > 0 ? (
          <span className="workspace-studio-section-count">{itemCount}</span>
        ) : null}
      </header>

      {children ?? (
        <div className="workspace-studio-grid">
          <StudioCard
            title={`New ${section.label.replace(/s$/, "")}`}
            subtitle="Ready for generation"
            status="empty"
            onGenerate={() => {}}
          />
        </div>
      )}
    </section>
  );
}
