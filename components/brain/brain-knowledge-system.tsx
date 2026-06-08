"use client";

import { useState } from "react";
import {
  BRAIN_SECTIONS,
  BRAIN_SYSTEM_STATS,
  type BrainSection,
  type BrainSectionId,
} from "@/lib/mock/brain-knowledge";
import { OsPanel, OsPanelContent, OsPanelHeader } from "@/components/shared/os-panel";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";

function BrainSectionNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: BrainSection[];
  activeId: BrainSectionId;
  onSelect: (id: BrainSectionId) => void;
}) {
  return (
    <OsPanel className="h-fit lg:sticky lg:top-24">
      <OsPanelHeader
        title="Knowledge Index"
        subtitle={`${BRAIN_SYSTEM_STATS.sections} domains · ${BRAIN_SYSTEM_STATS.entries} entries`}
      />
      <nav className="space-y-1 p-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeId;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-base transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1 font-medium">{section.title}</span>
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  section.status === "synced" ? "bg-primary" : "bg-amber-300/80",
                )}
              />
            </button>
          );
        })}
      </nav>
    </OsPanel>
  );
}

function BrainSectionDetail({ section }: { section: BrainSection }) {
  const Icon = section.icon;

  return (
    <OsPanel glow className="flex-1">
      <OsPanelHeader
        title={section.title}
        subtitle={section.subtitle}
        action={
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "text-sm font-normal",
                section.status === "synced"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-200",
              )}
            >
              {section.status === "synced" ? "Synced" : "Draft"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Updated {section.lastUpdated}
            </span>
          </div>
        }
      />
      <OsPanelContent>
        <div className="mb-8 flex items-center gap-4 rounded-2xl border border-border bg-muted/30 px-6 py-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-base font-medium">Milaene Brain</p>
            <p className="text-sm text-muted-foreground">
              Shared context · accessible to all agents
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {section.entries.map((entry) => (
            <div
              key={entry.label}
              className="luxury-surface rounded-2xl p-6 transition-colors hover:border-primary/15"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-label text-primary/80">{entry.label}</span>
                {entry.tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-muted/50 px-2 py-0.5 text-xs font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-base leading-relaxed text-muted-foreground">
                {entry.value}
              </p>
            </div>
          ))}
        </div>
      </OsPanelContent>
    </OsPanel>
  );
}

export function BrainKnowledgeSystem() {
  const [activeId, setActiveId] = useState<BrainSectionId>("brand_vision");
  const activeSection = BRAIN_SECTIONS.find((s) => s.id === activeId)!;

  return (
    <div className="space-y-10">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Status", value: "Online", icon: Brain, highlight: true },
          { label: "Domains", value: String(BRAIN_SYSTEM_STATS.sections) },
          { label: "Synced", value: String(BRAIN_SYSTEM_STATS.synced), highlight: true },
          { label: "Entries", value: String(BRAIN_SYSTEM_STATS.entries) },
        ].map((stat) => (
          <div key={stat.label} className="luxury-surface p-6">
            <p className="text-label">{stat.label}</p>
            <p
              className={cn(
                "mt-2 font-display text-4xl font-medium tracking-tight",
                stat.highlight ? "text-primary" : "text-foreground",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <BrainSectionNav
          sections={BRAIN_SECTIONS}
          activeId={activeId}
          onSelect={setActiveId}
        />
        <ScrollArea className="h-full min-h-[520px]">
          <BrainSectionDetail section={activeSection} />
        </ScrollArea>
      </div>
    </div>
  );
}
