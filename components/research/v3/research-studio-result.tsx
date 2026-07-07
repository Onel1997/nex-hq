"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { summarizeDesignConcepts } from "@/agents/research/design-concept";
import type { ResearchResult } from "./types";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Palette,
  RotateCcw,
} from "lucide-react";

interface ResearchStudioResultProps {
  result: ResearchResult;
  onNewResearch: () => void;
}

function confidencePercent(confidence?: number): number {
  if (confidence == null) return 0;
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

function formatReportType(reportType?: string): string | null {
  if (!reportType) return null;
  return reportType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function intelligenceModeLabel(result: ResearchResult): string | null {
  const brief = result.designBrief as
    | (typeof result.designBrief & { intelligenceMode?: string })
    | undefined;
  const mode = brief?.intelligenceMode;
  if (mode === "live") return "Live intelligence";
  if (mode === "simulated") return "Simulated intelligence";
  if (result.savedDomains.length > 0) {
    return `${result.savedDomains.length} Brain domain${result.savedDomains.length === 1 ? "" : "s"}`;
  }
  return null;
}

export function ResearchStudioResult({
  result,
  onNewResearch,
}: ResearchStudioResultProps) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  const isDesign = result.outputKind === "design";
  const brief = result.designBrief;

  const executiveSummary =
    result.outputKind === "research"
      ? result.executiveSummary
      : result.rationale ?? brief?.collectionIdea;

  const keyFindings =
    result.outputKind === "research"
      ? (result.keyFindings ?? [])
      : result.designs
        ? summarizeDesignConcepts(result.designs).slice(0, 6)
        : [];

  const opportunities =
    result.outputKind === "research"
      ? (result.opportunities ?? [])
      : brief?.productSuggestions ?? result.products ?? [];

  const recommendations =
    result.outputKind === "research"
      ? (result.recommendations ?? [])
      : result.designs?.length
        ? [`${result.designs.length} design concepts ready for creative development.`]
        : [];

  const reportType = formatReportType(
    result.outputKind === "research" ? result.reportType : "design",
  );
  const intelligenceLabel = intelligenceModeLabel(result);

  const handleApprove = useCallback(async () => {
    const recordId = result.reportRecordId;
    if (!recordId) {
      setActionError("Report record not available for approval.");
      return;
    }

    setApproving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reports/${recordId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Approval failed");
      }
      setApproved(true);
      setActionMessage("Report approved.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [result.reportRecordId]);

  const handleDesignHandoff = useCallback(async () => {
    setHandoffLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/design/from-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: result.reportId,
          mode: "all",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Design Studio handoff failed");
      }
      setActionMessage("Sent to Design Studio.");
      router.push("/agents/design");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setHandoffLoading(false);
    }
  }, [result.reportId, router]);

  return (
    <article className="rs3-result">
      <header className="rs3-result-header">
        <div className="rs3-result-badge">
          <CheckCircle2 className="size-4" />
          <span>Research complete</span>
        </div>
        <h2 className="rs3-result-title">{result.title}</h2>
        <div className="rs3-result-meta">
          {reportType ? (
            <span className="rs3-result-chip">{reportType}</span>
          ) : null}
          {result.confidence != null ? (
            <span className="rs3-result-chip rs3-result-chip-confidence">
              {confidencePercent(result.confidence)}% confidence
            </span>
          ) : null}
          {intelligenceLabel ? (
            <span className="rs3-result-chip rs3-result-chip-live">
              {intelligenceLabel}
            </span>
          ) : null}
        </div>
      </header>

      <div className="rs3-result-sections">
        {executiveSummary ? (
          <section className="rs3-result-section">
            <h3>Executive Summary</h3>
            <p>{executiveSummary}</p>
          </section>
        ) : null}

        {keyFindings.length > 0 ? (
          <section className="rs3-result-section">
            <h3>Key Findings</h3>
            <ul>
              {keyFindings.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {opportunities.length > 0 ? (
          <section className="rs3-result-section">
            <h3>Opportunities</h3>
            <ul>
              {opportunities.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {recommendations.length > 0 ? (
          <section className="rs3-result-section rs3-result-section-accent">
            <h3>Recommendations</h3>
            <ul>
              {recommendations.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {isDesign && result.designs && result.designs.length > 0 ? (
          <section className="rs3-result-section">
            <h3>Design Concepts</h3>
            <ul>
              {result.designs.slice(0, 5).map((design) => (
                <li key={design.designId}>{design.title}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {(actionMessage || actionError) && (
        <p
          className={cn(
            "rs3-result-feedback",
            actionError && "rs3-result-feedback-error",
          )}
        >
          {actionError ?? actionMessage}
        </p>
      )}

      <footer className="rs3-result-actions">
        <button
          type="button"
          className="rs3-btn rs3-btn-ghost"
          onClick={onNewResearch}
        >
          <RotateCcw className="size-3.5" />
          New Research
        </button>

        <Link href="/facility/reports" className="rs3-btn rs3-btn-secondary">
          <ExternalLink className="size-3.5" />
          Open Reports Center
        </Link>

        <button
          type="button"
          className="rs3-btn rs3-btn-accent"
          onClick={handleDesignHandoff}
          disabled={handoffLoading}
        >
          {handoffLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Palette className="size-3.5" />
          )}
          Send to Design Studio
        </button>

        <button
          type="button"
          className="rs3-btn rs3-btn-primary"
          onClick={handleApprove}
          disabled={approving || approved || !result.reportRecordId}
        >
          {approving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : approved ? (
            <CheckCircle2 className="size-3.5" />
          ) : null}
          {approved ? "Approved" : "Approve Report"}
        </button>
      </footer>
    </article>
  );
}
