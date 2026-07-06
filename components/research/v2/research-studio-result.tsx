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

  const marketOpportunities =
    result.outputKind === "research"
      ? (result.opportunities ?? [])
      : brief?.productSuggestions ?? result.products ?? [];

  const collectionOpportunities = isDesign
    ? [
        result.collection?.name,
        result.collection?.story,
        result.collection?.campaignTheme,
      ].filter(Boolean) as string[]
    : brief?.collectionIdea
      ? [brief.collectionIdea]
      : [];

  const competitorHighlights =
    result.outputKind === "research" && result.reportType === "competitor"
      ? (result.keyFindings ?? []).slice(0, 4)
      : brief?.competitorScore != null
        ? [`Competitor fit score: ${brief.competitorScore}%`]
        : [];

  const recommendedDirection =
    brief?.styleDirection ??
    brief?.rationale ??
    (result.outputKind === "research"
      ? result.recommendations?.[0]
      : undefined);

  const nextAction =
    result.outputKind === "research"
      ? (result.recommendations?.[0] ??
        "Review the report and send top concepts to Design Studio.")
      : "Send the collection to Design Studio for creative development.";

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
    <article className="research-studio-result">
      <header className="research-studio-result-header">
        <div className="research-studio-result-badge">
          <CheckCircle2 className="size-4" />
          <span>Research complete</span>
        </div>
        <h2 className="research-studio-result-title">{result.title}</h2>
        {result.confidence != null ? (
          <p className="research-studio-result-confidence">
            Confidence {confidencePercent(result.confidence)}%
          </p>
        ) : null}
      </header>

      <div className="research-studio-result-sections">
        {executiveSummary ? (
          <section className="research-studio-result-section">
            <h3>Executive Summary</h3>
            <p>{executiveSummary}</p>
          </section>
        ) : null}

        {keyFindings.length > 0 ? (
          <section className="research-studio-result-section">
            <h3>Key Findings</h3>
            <ul>
              {keyFindings.map((item, i) => (
                <li key={`${item}-${i}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {marketOpportunities.length > 0 ? (
          <section className="research-studio-result-section">
            <h3>Market Opportunities</h3>
            <ul>
              {marketOpportunities.map((item, i) => (
                <li key={`${item}-${i}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {collectionOpportunities.length > 0 ? (
          <section className="research-studio-result-section">
            <h3>Collection Opportunities</h3>
            <ul>
              {collectionOpportunities.map((item, i) => (
                <li key={`${item}-${i}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {competitorHighlights.length > 0 ? (
          <section className="research-studio-result-section">
            <h3>Competitor Highlights</h3>
            <ul>
              {competitorHighlights.map((item, i) => (
                <li key={`${item}-${i}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {recommendedDirection ? (
          <section className="research-studio-result-section research-studio-result-highlight">
            <h3>Recommended Direction</h3>
            <p>{recommendedDirection}</p>
            {brief?.trendScore != null ? (
              <p className="research-studio-result-scores">
                Trend {brief.trendScore}% · Competitor{" "}
                {brief.competitorScore ?? "—"}%
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="research-studio-result-section">
          <h3>Next Action</h3>
          <p>{nextAction}</p>
        </section>
      </div>

      {(actionMessage || actionError) && (
        <p
          className={cn(
            "research-studio-result-feedback",
            actionError && "research-studio-result-feedback-error",
          )}
        >
          {actionError ?? actionMessage}
        </p>
      )}

      <footer className="research-studio-result-actions">
        <button
          type="button"
          className="research-studio-btn research-studio-btn-primary"
          onClick={handleApprove}
          disabled={approving || approved || !result.reportRecordId}
        >
          {approving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : approved ? (
            <CheckCircle2 className="size-4" />
          ) : null}
          {approved ? "Approved" : "Approve Report"}
        </button>

        <Link
          href="/facility/reports"
          className="research-studio-btn research-studio-btn-secondary"
        >
          <ExternalLink className="size-4" />
          Open Reports Center
        </Link>

        <button
          type="button"
          className="research-studio-btn research-studio-btn-accent"
          onClick={handleDesignHandoff}
          disabled={handoffLoading}
        >
          {handoffLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Palette className="size-4" />
          )}
          Send to Design Studio
        </button>

        <button
          type="button"
          className="research-studio-btn research-studio-btn-ghost"
          onClick={onNewResearch}
        >
          <RotateCcw className="size-4" />
          New research
        </button>
      </footer>
    </article>
  );
}
