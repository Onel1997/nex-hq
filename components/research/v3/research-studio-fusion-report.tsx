"use client";

import type { ResearchStudioReport } from "@/lib/research-intelligence/report";
import {
  formatPriority,
  formatScoreTier,
  formatSeverity,
  formatSourceLabel,
  priorityChipClass,
  scoreChipClass,
  severityChipClass,
} from "@/lib/research-intelligence/report";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Layers,
  Palette,
  Sparkles,
  Target,
  Type,
  Zap,
} from "lucide-react";

interface ResearchStudioFusionReportProps {
  report: ResearchStudioReport;
}

function ScoreChip({
  score,
  tier,
  className,
}: {
  score: number;
  tier: string;
  className?: string;
}) {
  return (
    <span className={cn("rs3-fusion-chip", scoreChipClass(score, tier), className)}>
      {score}
      <span className="rs3-fusion-chip-suffix">/100</span>
    </span>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  return (
    <span className={cn("rs3-fusion-priority", priorityChipClass(priority))}>
      {formatPriority(priority)}
    </span>
  );
}

function SourceBadges({ sourceKeys }: { sourceKeys: string[] }) {
  if (sourceKeys.length === 0) return null;
  return (
    <div className="rs3-fusion-sources">
      {sourceKeys.slice(0, 5).map((key) => (
        <span key={key} className="rs3-fusion-source-badge">
          {formatSourceLabel(key)}
        </span>
      ))}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  tier,
  rationale,
  evidence,
}: {
  label: string;
  score: number;
  tier: string;
  rationale: string;
  evidence: string[];
}) {
  return (
    <article className="rs3-fusion-score-card">
      <div className="rs3-fusion-score-card-head">
        <h4>{label}</h4>
        <ScoreChip score={score} tier={tier} />
      </div>
      <p className="rs3-fusion-score-tier">{formatScoreTier(tier)} confidence</p>
      <p className="rs3-fusion-body">{rationale}</p>
      {evidence.length > 0 ? (
        <ul className="rs3-fusion-evidence">
          {evidence.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function RecommendationGrid({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: LucideIcon;
  items: ResearchStudioReport["designDirections"];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rs3-fusion-section">
      <header className="rs3-fusion-section-head">
        <Icon className="size-4" />
        <h3>{title}</h3>
      </header>
      <div className="rs3-fusion-card-grid">
        {items.map((item) => (
          <article key={item.id} className="rs3-fusion-rec-card">
            <div className="rs3-fusion-rec-card-head">
              <h4>{item.title}</h4>
              <div className="rs3-fusion-rec-meta">
                <PriorityChip priority={item.priority} />
                <ScoreChip score={item.confidence} tier="" />
              </div>
            </div>
            <p className="rs3-fusion-body">{item.why}</p>
            <SourceBadges sourceKeys={item.sourceKeys} />
            {item.evidence.length > 0 ? (
              <ul className="rs3-fusion-evidence">
                {item.evidence.slice(0, 2).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <p className="rs3-fusion-next">
              <ArrowRight className="size-3" />
              {item.suggestedNextStep}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ResearchStudioFusionReport({ report }: ResearchStudioFusionReportProps) {
  const hasScores =
    report.trendConfidence ||
    report.commercialConfidence ||
    report.sourceAgreement;

  return (
    <div className="rs3-fusion-report">
      <header className="rs3-fusion-hero">
        <div className="rs3-fusion-hero-glow" aria-hidden />
        <p className="rs3-fusion-eyebrow">Research Intelligence</p>
        <h2 className="rs3-fusion-title">{report.title}</h2>
        <div className="rs3-fusion-hero-meta">
          <ScoreChip score={report.overallConfidence} tier={report.overallTier} />
          <span className="rs3-fusion-hero-tier">
            {formatScoreTier(report.overallTier)} overall
          </span>
          {report.sourceCoverage ? (
            <span className="rs3-fusion-hero-sources">
              {report.sourceCoverage.liveCount} live · {report.sourceCoverage.providerCount}{" "}
              sources
            </span>
          ) : null}
        </div>
        {report.intelligenceWeak ? (
          <p className="rs3-fusion-weak-banner">
            Coverage is limited — treat directional outputs as provisional and expand sources
            before acting.
          </p>
        ) : null}
      </header>

      {report.executiveSummary ? (
        <section className="rs3-fusion-section rs3-fusion-section-hero">
          <header className="rs3-fusion-section-head">
            <Sparkles className="size-4" />
            <h3>Executive Summary</h3>
          </header>
          <p className="rs3-fusion-lead">{report.executiveSummary}</p>
        </section>
      ) : null}

      {hasScores ? (
        <section className="rs3-fusion-section">
          <header className="rs3-fusion-section-head">
            <Target className="size-4" />
            <h3>Confidence Scores</h3>
          </header>
          <div className="rs3-fusion-score-grid">
            {report.trendConfidence ? (
              <ScoreCard {...report.trendConfidence} />
            ) : null}
            {report.commercialConfidence ? (
              <ScoreCard {...report.commercialConfidence} />
            ) : null}
            {report.sourceAgreement ? (
              <ScoreCard {...report.sourceAgreement} />
            ) : null}
          </div>
        </section>
      ) : null}

      {report.sourceCoverage ? (
        <section className="rs3-fusion-section">
          <header className="rs3-fusion-section-head">
            <Layers className="size-4" />
            <h3>Source Coverage</h3>
          </header>
          <div className="rs3-fusion-coverage-meta">
            <span>{report.sourceCoverage.providerCount} providers</span>
            <span>{report.sourceCoverage.liveCount} live</span>
            <span>{report.sourceCoverage.simulatedCount} simulated</span>
            <span>{report.sourceCoverage.rolesCovered.length} roles</span>
          </div>
          <div className="rs3-fusion-coverage-grid">
            {report.sourceCoverage.sources.map((source) => (
              <article key={source.sourceKey} className="rs3-fusion-coverage-card">
                <div className="rs3-fusion-coverage-card-head">
                  <strong>{source.label}</strong>
                  <span
                    className={cn(
                      "rs3-fusion-mode",
                      source.mode === "live" ? "rs3-fusion-mode-live" : "rs3-fusion-mode-sim",
                    )}
                  >
                    {source.mode}
                  </span>
                </div>
                <p className="rs3-fusion-coverage-role">{source.role}</p>
                <p className="rs3-fusion-coverage-signals">
                  {source.signalCount} signals · weight {Math.round(source.weight * 100)}%
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report.keyInsights.length > 0 ? (
        <section className="rs3-fusion-section">
          <header className="rs3-fusion-section-head">
            <Zap className="size-4" />
            <h3>Key Insights</h3>
          </header>
          <div className="rs3-fusion-insight-list">
            {report.keyInsights.map((insight) => (
              <article key={insight.id} className="rs3-fusion-insight-card">
                <h4>{insight.headline}</h4>
                <p>{insight.detail}</p>
                <SourceBadges sourceKeys={insight.sourceKeys} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report.topOpportunities.length > 0 ? (
        <section className="rs3-fusion-section">
          <header className="rs3-fusion-section-head">
            <Target className="size-4" />
            <h3>Top Opportunities</h3>
          </header>
          <div className="rs3-fusion-card-grid">
            {report.topOpportunities.map((item) => (
              <article key={item.id} className="rs3-fusion-rec-card">
                <div className="rs3-fusion-rec-card-head">
                  <h4>{item.title}</h4>
                  <div className="rs3-fusion-rec-meta">
                    <PriorityChip priority={item.priority} />
                    <ScoreChip score={item.confidence} tier="" />
                  </div>
                </div>
                <p className="rs3-fusion-body">{item.detail}</p>
                <SourceBadges sourceKeys={item.sourceKeys} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <RecommendationGrid
        title="Recommended Design Directions"
        icon={Sparkles}
        items={report.designDirections}
      />

      <RecommendationGrid
        title="Recommended Products"
        icon={Target}
        items={report.recommendedProducts}
      />

      <RecommendationGrid
        title="Color Palette Suggestions"
        icon={Palette}
        items={report.colorPalettes}
      />

      {report.typographyDirection ? (
        <section className="rs3-fusion-section">
          <header className="rs3-fusion-section-head">
            <Type className="size-4" />
            <h3>Typography Direction</h3>
          </header>
          <article className="rs3-fusion-direction-card">
            <div className="rs3-fusion-rec-card-head">
              <h4>{report.typographyDirection.title}</h4>
              <ScoreChip
                score={report.typographyDirection.confidence}
                tier=""
              />
            </div>
            <p className="rs3-fusion-body">{report.typographyDirection.why}</p>
            <p className="rs3-fusion-next">
              <ArrowRight className="size-3" />
              {report.typographyDirection.suggestedNextStep}
            </p>
          </article>
        </section>
      ) : null}

      {report.graphicThemeDirection ? (
        <section className="rs3-fusion-section">
          <header className="rs3-fusion-section-head">
            <Palette className="size-4" />
            <h3>Graphic Theme Direction</h3>
          </header>
          <article className="rs3-fusion-direction-card">
            <div className="rs3-fusion-rec-card-head">
              <h4>{report.graphicThemeDirection.title}</h4>
              <ScoreChip
                score={report.graphicThemeDirection.confidence}
                tier=""
              />
            </div>
            <p className="rs3-fusion-body">{report.graphicThemeDirection.why}</p>
            <p className="rs3-fusion-next">
              <ArrowRight className="size-3" />
              {report.graphicThemeDirection.suggestedNextStep}
            </p>
          </article>
        </section>
      ) : null}

      {report.riskWarnings.length > 0 ? (
        <section className="rs3-fusion-section rs3-fusion-section-risk">
          <header className="rs3-fusion-section-head">
            <AlertTriangle className="size-4" />
            <h3>Risk Warnings</h3>
          </header>
          <div className="rs3-fusion-risk-list">
            {report.riskWarnings.map((risk) => (
              <article key={risk.id} className="rs3-fusion-risk-card">
                <div className="rs3-fusion-risk-head">
                  <h4>{risk.title}</h4>
                  <span
                    className={cn(
                      "rs3-fusion-severity",
                      severityChipClass(risk.severity),
                    )}
                  >
                    {formatSeverity(risk.severity)}
                  </span>
                </div>
                <p>{risk.reason}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report.suggestedNextActions.length > 0 ? (
        <section className="rs3-fusion-section rs3-fusion-section-actions">
          <header className="rs3-fusion-section-head">
            <ArrowRight className="size-4" />
            <h3>Suggested Next Actions</h3>
          </header>
          <div className="rs3-fusion-action-list">
            {report.suggestedNextActions.map((action) => (
              <article key={action.id} className="rs3-fusion-action-card">
                <div className="rs3-fusion-action-head">
                  <h4>{action.title}</h4>
                  <PriorityChip priority={action.priority} />
                </div>
                <p className="rs3-fusion-body">{action.why}</p>
                <p className="rs3-fusion-next">
                  <ArrowRight className="size-3" />
                  {action.suggestedNextStep}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report.caveats.length > 0 ? (
        <footer className="rs3-fusion-caveats">
          {report.caveats.slice(0, 4).map((caveat) => (
            <p key={caveat}>{caveat}</p>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
