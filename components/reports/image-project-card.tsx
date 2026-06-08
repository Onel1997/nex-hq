"use client";

import Link from "next/link";
import type { ReportListItem } from "@/lib/mock/reports";
import { countImageAssets } from "@/agents/image/normalized";
import { ReportReviewActions } from "@/components/reports/report-review-actions";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Download,
  ImageIcon,
  Trash2,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImageProjectCardProps {
  report: ReportListItem;
  agentName: string;
  statusLabel: string;
  onDelete?: (brainRecordId: string) => void;
  onReviewComplete?: () => void | Promise<void>;
  onReviewError?: (message: string) => void;
}

export function ImageProjectCard({
  report,
  agentName,
  statusLabel,
  onDelete,
  onReviewComplete,
  onReviewError,
}: ImageProjectCardProps) {
  const t = useT();
  const project = report.imageProject;
  const assetCount = project
    ? countImageAssets(project.corePackage, project.advancedPackage)
    : 0;
  const brainRecordId = report.brainRecordId ?? report.id;

  return (
    <div className="luxury-surface rounded-2xl p-6 transition-colors hover:border-primary/15">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {agentName}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {statusLabel}
            </Badge>
          </div>
          <h3 className="font-display text-2xl font-medium">
            {project?.projectName ?? report.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {report.summary}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{new Date(report.createdAt).toLocaleDateString()}</p>
          <p>
            {assetCount} {t("image.interface.assets")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t("image.interface.confidence")}
        </span>
        <Progress value={report.confidence * 100} className="h-1 w-24" />
        <span className="tabular-nums text-sm">
          {Math.round(report.confidence * 100)}%
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/projects/${brainRecordId}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium",
            "hover:bg-muted/30",
          )}
        >
          <ArrowRight className="size-4" />
          {t("image.interface.openProject")}
        </Link>
        <Link
          href={`/projects/${brainRecordId}?generate=1`}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/30"
        >
          <Wand2 className="size-4" />
          {t("image.interface.generateImages")}
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/30"
          onClick={() => {
            const blob = new Blob([JSON.stringify(project, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${project?.projectName ?? report.title}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" />
          {t("image.interface.export")}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(brainRecordId)}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
            {t("image.interface.delete")}
          </button>
        )}
        <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" />
          {t("image.interface.corePackage")}: {project?.corePackage.length ?? 0}
        </span>
      </div>

      {onReviewComplete && (
        <ReportReviewActions
          brainRecordId={brainRecordId}
          status={report.status}
          onReviewComplete={onReviewComplete}
          onError={onReviewError}
          className="mt-4 border-t border-border pt-4"
        />
      )}
    </div>
  );
}
