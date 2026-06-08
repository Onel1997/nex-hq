"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImageProjectWorkspace } from "@/components/image/image-project-workspace";
import type { ImageProjectView } from "@/lib/reports/image-project";
import { useT } from "@/lib/i18n";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function ImageProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const [brainRecordId, setBrainRecordId] = useState<string | null>(null);
  const [project, setProject] = useState<ImageProjectView | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((value) => setBrainRecordId(value.id));
  }, [params]);

  const loadProject = useCallback(async () => {
    if (!brainRecordId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${brainRecordId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? t("image.errors.unexpected"));
      }

      const imageProject = data.report?.imageProject;
      if (!imageProject) {
        throw new Error(t("image.errors.projectNotFound"));
      }

      setProject(imageProject);
      setReportId(data.report.id);
      setConfidence(data.report.confidence ?? 0);
      setTitle(data.report.title ?? imageProject.projectName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("image.errors.unexpected"));
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  }, [brainRecordId, t]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        {t("image.interface.loadingProject")}
      </div>
    );
  }

  if (error || !project || !reportId || !brainRecordId) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error ?? t("image.errors.unexpected")}</p>
        <Link href="/reports" className="text-primary hover:underline">
          {t("image.interface.backToReports")}
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("image.interface.backToReports")}
      </Link>

      <div className="luxury-surface-elevated rounded-2xl p-8">
        <ImageProjectWorkspace
          reportId={reportId}
          reportRecordId={brainRecordId}
          projectName={title}
          moodboard={project.moodboard}
          palette={
            project.palette ?? {
              primary: "Obsidian Black #111111",
              secondary: "Concrete Grey #888888",
              accent: "Signal Green #6FBF73",
              background: "Off-White #F5F5F0",
              text: "Charcoal #2A2A2A",
            }
          }
          corePackage={project.corePackage}
          advancedPackage={project.advancedPackage}
          campaignShots={project.campaignShots}
          confidence={confidence}
          sourceReportTitles={project.sourceReportTitles}
        />
      </div>
    </section>
  );
}
