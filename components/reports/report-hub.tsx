"use client";

import { AGENT_CATALOG } from "@/lib/constants/agents";
import {
  MOCK_REPORTS,
  REPORT_CATEGORY_LABELS,
  type ReportListItem,
} from "@/lib/mock/reports";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Palette,
  Search,
  Settings2,
} from "lucide-react";

const CATEGORY_ICONS = {
  research: Search,
  design: Palette,
  marketing: Megaphone,
  operations: Settings2,
} as const;

const STATUS_STYLES: Record<ReportListItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground",
};

function ReportCard({ report }: { report: ReportListItem }) {
  const CategoryIcon = CATEGORY_ICONS[report.category];

  return (
    <div className="luxury-surface rounded-2xl p-8 transition-colors hover:border-primary/15">
      <div className="flex items-start gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CategoryIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-medium leading-snug">
                {report.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {report.summary}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-sm font-normal capitalize", STATUS_STYLES[report.status])}
            >
              {report.status}
            </Badge>
          </div>

          {report.highlights && report.highlights.length > 0 && (
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {report.highlights.map((h) => (
                <li
                  key={h}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {REPORT_CATEGORY_LABELS[report.category]}
            </Badge>
            <span>{AGENT_CATALOG[report.agentId].name}</span>
            {report.drop && <span>{report.drop}</span>}
            <div className="ml-auto flex items-center gap-3">
              <Progress value={report.confidence * 100} className="h-1 w-20" />
              <span className="tabular-nums">{Math.round(report.confidence * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportList({ reports }: { reports: ReportListItem[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-20 text-center text-base text-muted-foreground">
        No reports in this category yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}

export function ReportHub() {
  const categories = ["all", "research", "design", "marketing"] as const;

  const counts: Record<(typeof categories)[number], number> = {
    all: MOCK_REPORTS.length,
    research: MOCK_REPORTS.filter((r) => r.category === "research").length,
    design: MOCK_REPORTS.filter((r) => r.category === "design").length,
    marketing: MOCK_REPORTS.filter((r) => r.category === "marketing").length,
  };

  return (
    <div className="space-y-10">
      <SectionHeading
        label="Intelligence"
        title="Agent reports"
        description="Research, design, and marketing briefs — ready for your review."
      />

      <Tabs defaultValue="all" className="space-y-8">
        <TabsList className="h-12 bg-muted/30 p-1">
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="gap-2 px-5 text-base">
              {cat === "all" ? "All" : REPORT_CATEGORY_LABELS[cat]}
              <span className="text-sm text-muted-foreground">{counts[cat]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <ReportList
              reports={
                cat === "all"
                  ? MOCK_REPORTS
                  : MOCK_REPORTS.filter((r) => r.category === cat)
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
