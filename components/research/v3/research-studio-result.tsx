"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { summarizeDesignConcepts } from "@/agents/research/design-concept";
import { reportHasVisibleSections } from "@/lib/research-intelligence/report";
import type { ProviderSnapshot } from "./data-source-types";
import type { FusionReportError, ResearchResultV3 } from "./types";
import { ResearchStudioFusionReport } from "./research-studio-fusion-report";
import { ResearchStudioRunCoverage } from "./research-studio-run-coverage";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface ResearchStudioResultProps {
  result: ResearchResultV3;
  providers: ProviderSnapshot[];
  fusionError: FusionReportError | null;
  fusionRetrying: boolean;
  onRetryFusion: () => void;
  onNewResearch: () => void;
}

function confidencePercent(confidence?: number): number {
  if (confidence == null) return 0;
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

function LegacyResearchSections({
  result,
  compact = false,
}: {
  result: ResearchResultV3;
  compact?: boolean;
}) {
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

  return (
    <div className={cn("rs3-result-sections", compact && "rs3-result-sections-compact")}>
      {!compact ? (
        <header className="rs3-result-header">
          <h2 className="rs3-result-title">{result.title}</h2>
          <div className="rs3-result-meta">
            {result.confidence != null ? (
              <span className="rs3-result-chip rs3-result-chip-confidence">
                {confidencePercent(result.confidence)}% confidence
              </span>
            ) : null}
          </div>
        </header>
      ) : null}

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
  );
}

export function ResearchStudioResult({
  result,
  providers,
  fusionError,
  fusionRetrying,
  onRetryFusion,
  onNewResearch,
}: ResearchStudioResultProps) {
  const [approving, setApproving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [legacyExpanded, setLegacyExpanded] = useState(false);

  const fusionReport =
    result.fusionReport && reportHasVisibleSections(result.fusionReport)
      ? result.fusionReport
      : null;

  const showFusionPrimary =
    result.outputKind === "research" && fusionReport != null && !fusionError;
  const showFusionWarning =
    result.outputKind === "research" && fusionReport == null && fusionError != null;

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

  return (
    <article
      className={cn("rs3-result", showFusionPrimary && "rs3-result-fusion")}
    >
      <div className="rs3-result-fusion-badge">
        <CheckCircle2 className="size-4" />
        <span>Research complete</span>
      </div>

      {showFusionWarning ? (
        <div className="rs3-fusion-warning" role="status">
          <div className="rs3-fusion-warning-copy">
            <AlertTriangle className="size-4 shrink-0" />
            <div>
              <strong>Fusion report unavailable</strong>
              <p>{fusionError.message}</p>
            </div>
          </div>
          <button
            type="button"
            className="rs3-btn rs3-btn-secondary"
            onClick={onRetryFusion}
            disabled={fusionRetrying}
          >
            {fusionRetrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Retry fusion report
          </button>
        </div>
      ) : null}

      {showFusionPrimary ? (
        <ResearchStudioFusionReport report={fusionReport} />
      ) : (
        <LegacyResearchSections result={result} />
      )}

      {showFusionPrimary ? (
        <details
          className="rs3-result-legacy-fallback"
          open={legacyExpanded}
          onToggle={(event) =>
            setLegacyExpanded((event.target as HTMLDetailsElement).open)
          }
        >
          <summary>
            <span>Original research output</span>
            <ChevronDown className="size-3.5" aria-hidden />
          </summary>
          <LegacyResearchSections result={result} compact />
        </details>
      ) : null}

      <ResearchStudioRunCoverage providers={providers} />

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
