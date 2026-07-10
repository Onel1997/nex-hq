"use client";

import type { ResearchStudioReport } from "@/lib/research-intelligence/report";
import { ResearchStudioCreativeBrief } from "./research-studio-creative-brief";
import { CollapsibleSection } from "./collapsible-section";
import {
  formatLaunchPriority,
  formatPriority,
  formatScoreTier,
  formatSeverity,
  formatSourceLabel,
  priorityChipClass,
  scoreChipClass,
  severityChipClass,
} from "@/lib/research-intelligence/report";
import { useDictionary, useLocale } from "@/lib/i18n";
import { getIntelligenceCopy } from "@/lib/research-intelligence/copy";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  FileText,
  Layers,
  Palette,
  Shield,
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
  const locale = useLocale();
  return (
    <span className={cn("rs3-fusion-priority", priorityChipClass(priority))}>
      {formatPriority(priority, locale)}
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
  const locale = useLocale();
  const { research } = useDictionary();
  return (
    <article className="rs3-fusion-score-card">
      <div className="rs3-fusion-score-card-head">
        <h4>{label}</h4>
        <ScoreChip score={score} tier={tier} />
      </div>
      <p className="rs3-fusion-score-tier">
        {formatScoreTier(tier, locale)} {research.studio.fusion.confidenceSuffix}
      </p>
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

function LaunchPriorityChip({ priority }: { priority: string }) {
  const locale = useLocale();
  const className =
    priority === "A"
      ? "rs3-fusion-launch-a"
      : priority === "B"
        ? "rs3-fusion-launch-b"
        : priority === "C"
          ? "rs3-fusion-launch-c"
          : "rs3-fusion-launch-d";
  return <span className={cn("rs3-fusion-launch-priority", className)}>{formatLaunchPriority(priority, locale)}</span>;
}

function PriorityTrafficLight({ signal }: { signal: string }) {
  const copy = getIntelligenceCopy(useLocale()).priority;
  const labels = {
    develop: { emoji: "🟢", label: copy.develop },
    watch: { emoji: "🟡", label: copy.watch },
    reject: { emoji: "🔴", label: copy.reject },
  } as const;
  const entry = labels[signal as keyof typeof labels] ?? labels.watch;
  return (
    <span className={cn("rs3-fusion-ampel", `rs3-fusion-ampel-${signal}`)}>
      <span aria-hidden>{entry.emoji}</span>
      {entry.label}
    </span>
  );
}

function SourceTrustSection({
  entries,
}: {
  entries: ResearchStudioReport["sourceTrust"];
}) {
  const { research } = useDictionary();
  const f = research.studio.fusion;

  if (entries.length === 0) return null;

  return (
    <section className="rs3-fusion-section rs3-fusion-section-trust">
      <header className="rs3-fusion-section-head">
        <Shield className="size-4" />
        <h3>{f.sourceTrust}</h3>
      </header>
      <div className="rs3-fusion-trust-grid">
        {entries.map((entry) => (
          <article
            key={entry.sourceKey}
            className={cn(
              "rs3-fusion-trust-card",
              !entry.connected && "rs3-fusion-trust-card-off",
            )}
          >
            <strong>{entry.label}</strong>
            <span className="rs3-fusion-trust-stars">
              {entry.connected
                ? "★".repeat(entry.stars) + "☆".repeat(5 - entry.stars)
                : entry.statusLabel}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function PrioritizedOpportunitiesSection({
  items,
}: {
  items: ResearchStudioReport["prioritizedOpportunities"];
}) {
  const { research } = useDictionary();
  const f = research.studio.fusion;

  if (items.length === 0) return null;

  return (
    <section className="rs3-fusion-section rs3-fusion-section-priority">
      <header className="rs3-fusion-section-head">
        <Target className="size-4" />
        <h3>{f.prioritizedOpportunities}</h3>
      </header>
      <div className="rs3-fusion-priority-grid">
        {items.map((item) => (
          <article key={item.id} className="rs3-fusion-priority-card">
            <div className="rs3-fusion-priority-card-head">
              <h4>{item.trend}</h4>
              <PriorityTrafficLight signal={item.prioritySignal} />
            </div>
            <dl className="rs3-fusion-priority-metrics">
              <div>
                <dt>{f.brandFitLabel}</dt>
                <dd>{item.brandFit}</dd>
              </div>
              <div>
                <dt>{f.trendScoreLabel}</dt>
                <dd>{item.trendScore}</dd>
              </div>
              <div>
                <dt>{f.commercialPotentialLabel}</dt>
                <dd>{item.commercialPotential}</dd>
              </div>
            </dl>
            <p className="rs3-fusion-priority-why">
              <strong>{f.whyRecommended}:</strong> {item.whyRecommended}
            </p>
            <p className="rs3-fusion-next">
              <ArrowRight className="size-3" />
              <strong>{f.nextStepLabel}:</strong> {item.nextStep}
            </p>
            <SourceBadges sourceKeys={item.sourceKeys} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ExecutiveNarrativeSection({
  narrative,
}: {
  narrative: NonNullable<ResearchStudioReport["executiveNarrative"]>;
}) {
  const { research } = useDictionary();
  const ic = research.studio.fusion;
  const blocks = [
    { label: "Was wurde gefunden?", text: narrative.whatFound },
    { label: "Warum ist es interessant?", text: narrative.whyInteresting },
    { label: "Passt es zu Milaene?", text: narrative.milaeneFit },
    { label: "Sollte gehandelt werden?", text: narrative.shouldAct },
  ];

  return (
    <section className="rs3-fusion-section rs3-fusion-section-hero">
      <header className="rs3-fusion-section-head">
        <Sparkles className="size-4" />
        <h3>{ic.executiveSummary}</h3>
      </header>
      <div className="rs3-fusion-narrative">
        {blocks.map((block) => (
          <div key={block.label} className="rs3-fusion-narrative-block">
            <h4>{block.label}</h4>
            <p>{block.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandIntelligenceSection({
  brandIntelligence,
}: {
  brandIntelligence: NonNullable<ResearchStudioReport["brandIntelligence"]>;
}) {
  const { research } = useDictionary();
  const bi = research.studio.brandIntelligence;
  return (
    <div className="rs3-fusion-brand-wrap">
      <div className="rs3-fusion-brand-hero">
        <div className="rs3-fusion-brand-score-block">
          <p className="rs3-fusion-brand-label">{bi.brandFitScore}</p>
          <ScoreChip score={brandIntelligence.brandFitScore} tier={brandIntelligence.brandFitTier} />
          <p className="rs3-fusion-brand-tier">{brandIntelligence.brandFitTierLabel}</p>
        </div>
        <p className="rs3-fusion-body">{brandIntelligence.summary}</p>
        {brandIntelligence.shopifyCatalogLoaded ? (
          <p className="rs3-fusion-brand-shopify">{bi.shopifyLearning}</p>
        ) : null}
      </div>

      {brandIntelligence.reasons.length > 0 ? (
        <div className="rs3-fusion-brand-block">
          <h4>{bi.reasons}</h4>
          <ul className="rs3-fusion-evidence">
            {brandIntelligence.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rs3-fusion-brand-columns">
        {brandIntelligence.matches.length > 0 ? (
          <div className="rs3-fusion-brand-block">
            <h4>
              <CheckCircle2 className="size-3.5" />
              {bi.matches}
            </h4>
            <div className="rs3-fusion-brand-tags">
              {brandIntelligence.matches.map((match) => (
                <span key={match} className="rs3-fusion-brand-tag rs3-fusion-brand-tag-match">
                  {match}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {brandIntelligence.conflicts.length > 0 ? (
          <div className="rs3-fusion-brand-block">
            <h4>
              <Ban className="size-3.5" />
              {bi.conflicts}
            </h4>
            <div className="rs3-fusion-brand-tags">
              {brandIntelligence.conflicts.map((conflict) => (
                <span key={conflict} className="rs3-fusion-brand-tag rs3-fusion-brand-tag-conflict">
                  {conflict}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {brandIntelligence.recommendedAdjustments.length > 0 ? (
        <div className="rs3-fusion-brand-block">
          <h4>{bi.recommendedAdjustments}</h4>
          <ul className="rs3-fusion-evidence">
            {brandIntelligence.recommendedAdjustments.map((adjustment) => (
              <li key={adjustment}>{adjustment}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {brandIntelligence.dimensionBreakdown.length > 0 ? (
        <div className="rs3-fusion-brand-dimensions">
          {brandIntelligence.dimensionBreakdown.map((dimension) => (
            <article key={dimension.id} className="rs3-fusion-brand-dimension">
              <div className="rs3-fusion-brand-dimension-head">
                <span>{dimension.label}</span>
                <ScoreChip score={dimension.score} tier="" />
              </div>
              <p>{dimension.rationale}</p>
            </article>
          ))}
        </div>
      ) : null}

      {brandIntelligence.rejectedOpportunities.length > 0 ? (
        <div className="rs3-fusion-brand-block rs3-fusion-brand-rejected">
          <h4>{bi.rejectedOpportunities}</h4>
          <div className="rs3-fusion-card-grid">
            {brandIntelligence.rejectedOpportunities.map((opp) => (
              <article key={opp.id} className="rs3-fusion-rec-card rs3-fusion-brand-reject-card">
                <div className="rs3-fusion-rec-card-head">
                  <h4>{opp.title}</h4>
                  <div className="rs3-fusion-rec-meta">
                    <span className="rs3-fusion-brand-reject-badge">{bi.rejected}</span>
                    <ScoreChip score={opp.trendScore} tier="" />
                  </div>
                </div>
                <div className="rs3-fusion-brand-opp-scores">
                  <span>{bi.trendScore} {opp.trendScore}</span>
                  <span>{bi.brandFit} {opp.brandFit}</span>
                </div>
                <p className="rs3-fusion-body">{bi.rejectedBecause}</p>
                <ul className="rs3-fusion-evidence">
                  {opp.rejectionReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ResearchStudioFusionReport({ report }: ResearchStudioFusionReportProps) {
  const locale = useLocale();
  const { research } = useDictionary();
  const f = research.studio.fusion;
  const hasScores =
    report.trendConfidence ||
    report.commercialConfidence ||
    report.sourceAgreement;

  return (
    <div className="rs3-fusion-report">
      <header className="rs3-fusion-hero">
        <div className="rs3-fusion-hero-glow" aria-hidden />
        <p className="rs3-fusion-eyebrow">{f.eyebrow}</p>
        <h2 className="rs3-fusion-title">{report.title}</h2>
        <div className="rs3-fusion-hero-meta">
          <ScoreChip score={report.overallConfidence} tier={report.overallTier} />
          <span className="rs3-fusion-hero-tier">
            {f.overallTier.replace("{tier}", formatScoreTier(report.overallTier, locale))}
          </span>
          {report.sourceCoverage ? (
            <span className="rs3-fusion-hero-sources">
              {f.liveSources
                .replace("{live}", String(report.sourceCoverage.liveCount))
                .replace("{total}", String(report.sourceCoverage.providerCount))}
            </span>
          ) : null}
        </div>
        {report.intelligenceWeak ? (
          <p className="rs3-fusion-weak-banner">{f.weakBanner}</p>
        ) : null}
      </header>

      {report.executiveNarrative ? (
        <ExecutiveNarrativeSection narrative={report.executiveNarrative} />
      ) : report.executiveSummary ? (
        <section className="rs3-fusion-section rs3-fusion-section-hero">
          <header className="rs3-fusion-section-head">
            <Sparkles className="size-4" />
            <h3>{f.executiveSummary}</h3>
          </header>
          <p className="rs3-fusion-lead">{report.executiveSummary}</p>
        </section>
      ) : null}

      <SourceTrustSection entries={report.sourceTrust} />

      <PrioritizedOpportunitiesSection items={report.prioritizedOpportunities} />

      {hasScores ? (
        <CollapsibleSection
          title={f.confidenceScores}
          icon={<Target className="size-4" />}
          expandLabel={f.expandSection}
          collapseLabel={f.collapseSection}
        >
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
        </CollapsibleSection>
      ) : null}

      {report.brandIntelligence ? (
        <CollapsibleSection
          title={research.studio.brandIntelligence.title}
          icon={<Shield className="size-4" />}
          expandLabel={f.expandSection}
          collapseLabel={f.collapseSection}
        >
          <BrandIntelligenceSection brandIntelligence={report.brandIntelligence} />
        </CollapsibleSection>
      ) : null}

      {report.creativeBrief ? (
        <CollapsibleSection
          title={research.studio.creativeBrief.title}
          icon={<FileText className="size-4" />}
          expandLabel={f.expandSection}
          collapseLabel={f.collapseSection}
        >
          <ResearchStudioCreativeBrief
            brief={report.creativeBrief}
            generatedAt={report.generatedAt}
            embedded
          />
        </CollapsibleSection>
      ) : null}

      {report.sourceCoverage ? (
        <CollapsibleSection
          title={f.sourceCoverage}
          icon={<Layers className="size-4" />}
          expandLabel={f.expandSection}
          collapseLabel={f.collapseSection}
        >
          <div className="rs3-fusion-coverage-meta">
            <span>{report.sourceCoverage.providerCount} {f.providers}</span>
            <span>{report.sourceCoverage.liveCount} {f.live}</span>
            <span>{report.sourceCoverage.simulatedCount} {f.simulated}</span>
            <span>{report.sourceCoverage.rolesCovered.length} {f.roles}</span>
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
                    {source.mode === "live" ? f.modeLive : f.modeSimulated}
                  </span>
                </div>
                <p className="rs3-fusion-coverage-role">{source.role}</p>
                <p className="rs3-fusion-coverage-signals">
                  {source.signalCount} {f.signals}
                </p>
              </article>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {report.keyInsights.length > 0 ? (
        <CollapsibleSection
          title={f.keyInsights}
          icon={<Zap className="size-4" />}
          expandLabel={f.expandSection}
          collapseLabel={f.collapseSection}
        >
          <div className="rs3-fusion-insight-list">
            {report.keyInsights.map((insight) => (
              <article key={insight.id} className="rs3-fusion-insight-card">
                <h4>{insight.headline}</h4>
                <p>{insight.detail}</p>
                <SourceBadges sourceKeys={insight.sourceKeys} />
              </article>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {report.riskWarnings.length > 0 ? (
        <section className="rs3-fusion-section rs3-fusion-section-risk">
          <header className="rs3-fusion-section-head">
            <AlertTriangle className="size-4" />
            <h3>{f.riskWarnings}</h3>
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
                    {formatSeverity(risk.severity, locale)}
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
            <h3>{f.suggestedNextActions}</h3>
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
