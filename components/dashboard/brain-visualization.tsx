"use client";

import Link from "next/link";
import { getBrainNodes } from "@/lib/i18n/data";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function BrainVisualization() {
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const { dashboard } = useDictionary();
  const brainNodes = getBrainNodes(locale);
  const totalEntries = brainNodes.reduce((sum, n) => sum + n.entries, 0);
  const avgSync = Math.round(
    brainNodes.reduce((sum, n) => sum + n.sync, 0) / brainNodes.length,
  );

  return (
    <section className="space-y-12">
      <SectionHeading
        label={dashboard.brainViz.label}
        title={t("dashboard.brainViz.title", { workspace: workspace.name })}
        description={dashboard.brainViz.description}
        action={
          <Link
            href="/facility/knowledge"
            className="flex items-center gap-2 text-base text-muted-foreground transition-colors hover:text-primary"
          >
            {dashboard.brainViz.exploreBrain}
            <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="luxury-surface-elevated relative overflow-hidden p-10 lg:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.82_0.055_85/0.08),transparent_70%)]" />

        <div className="relative mb-14 flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-20">
          <div className="text-center">
            <p className="font-display text-6xl font-medium tabular-nums tracking-tight text-foreground">
              {totalEntries}
            </p>
            <p className="mt-2 text-base text-muted-foreground">
              {dashboard.brainViz.knowledgeEntries}
            </p>
          </div>
          <div className="hidden h-16 w-px bg-border sm:block" />
          <div className="text-center">
            <p className="font-display text-6xl font-medium tabular-nums tracking-tight text-primary">
              {avgSync}%
            </p>
            <p className="mt-2 text-base text-muted-foreground">
              {dashboard.brainViz.synced}
            </p>
          </div>
        </div>

        <div className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {brainNodes.map((node) => (
            <div
              key={node.id}
              className={cn(
                "group rounded-2xl border border-border bg-background/30 p-6",
                "transition-all duration-500 hover:border-primary/25 hover:bg-primary/[0.03]",
              )}
            >
              <div className="mb-5 flex items-center justify-between">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    node.status === "live" && "bg-primary",
                    node.status === "syncing" && "animate-pulse bg-amber-300/80",
                    node.status === "draft" && "bg-muted-foreground/50",
                  )}
                />
                <span className="text-sm tabular-nums text-muted-foreground">
                  {node.sync}%
                </span>
              </div>
              <h3 className="font-display text-xl font-medium leading-snug text-foreground">
                {node.label}
              </h3>
              <p className="mt-2 text-base text-muted-foreground">
                {t("common.entriesCount", { count: node.entries })}
              </p>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-700"
                  style={{ width: `${node.sync}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
