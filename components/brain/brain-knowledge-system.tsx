"use client";

import { useState } from "react";
import type { BrainSectionId } from "@/lib/mock/brain-knowledge";
import { getBrainSections, getBrainSystemStats } from "@/lib/i18n/data";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { OsPanel, OsPanelContent, OsPanelHeader } from "@/components/shared/os-panel";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";

export function BrainKnowledgeSystem() {
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const { brain, platform } = useDictionary();
  const sections = getBrainSections(locale, workspace.name);
  const stats = getBrainSystemStats(locale, workspace.name);
  const [activeId, setActiveId] = useState<BrainSectionId>("brand_vision");
  const activeSection = sections.find((s) => s.id === activeId)!;

  return (
    <div className="space-y-10">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: brain.stats.status,
            value: t("common.status.online"),
            icon: Brain,
            highlight: true,
          },
          { label: brain.stats.domains, value: String(stats.sections) },
          {
            label: brain.stats.synced,
            value: String(stats.synced),
            highlight: true,
          },
          { label: brain.stats.entries, value: String(stats.entries) },
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
        <OsPanel className="h-fit lg:sticky lg:top-24">
          <OsPanelHeader
            title={brain.knowledgeIndex}
            subtitle={t("brain.domainsEntries", {
              domains: stats.sections,
              entries: stats.entries,
            })}
          />
          <nav className="space-y-1 p-4">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeId;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveId(section.id)}
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
                      section.status === "synced"
                        ? "bg-primary"
                        : "bg-amber-300/80",
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </OsPanel>

        <ScrollArea className="h-full min-h-[520px]">
          <OsPanel glow className="flex-1">
            <OsPanelHeader
              title={activeSection.title}
              subtitle={activeSection.subtitle}
              action={
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-sm font-normal",
                      activeSection.status === "synced"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200",
                    )}
                  >
                    {activeSection.status === "synced"
                      ? t("common.status.synced")
                      : t("common.status.draft")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {t("common.updated")} {activeSection.lastUpdated}
                  </span>
                </div>
              }
            />
            <OsPanelContent>
              <div className="mb-8 flex items-center gap-4 rounded-2xl border border-border bg-muted/30 px-6 py-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Brain className="size-5" />
                </div>
                <div>
                  <p className="text-base font-medium">{platform.brainName}</p>
                  <p className="text-sm text-muted-foreground">
                    {brain.sharedContext}
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {activeSection.entries.map((entry) => (
                  <div
                    key={entry.label}
                    className="luxury-surface rounded-2xl p-6 transition-colors hover:border-primary/15"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-label text-primary/80">
                        {entry.label}
                      </span>
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
        </ScrollArea>
      </div>
    </div>
  );
}
