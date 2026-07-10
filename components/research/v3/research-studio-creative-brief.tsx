"use client";

import type { ReportCreativeBrief } from "@/lib/research-intelligence/report";
import { saveFusionCreativeBriefHandoff } from "@/lib/research-intelligence/creative-brief/handoff-store";
import { activateFusionHandoffInDesignStudio } from "@/lib/research-intelligence/creative-brief/fusion-handoff";
import { useDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ResearchStudioCreativeBriefProps {
  brief: ReportCreativeBrief;
  generatedAt: string;
  embedded?: boolean;
}

function BriefList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="rs3-brief-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function BriefScoreGrid({
  scores,
  labels,
}: {
  scores: ReportCreativeBrief["scores"];
  labels: ReportCreativeBrief["scores"] extends infer _T
    ? {
        trendScore: string;
        brandFit: string;
        commercialPotential: string;
        competition: string;
        longevity: string;
        originality: string;
      }
    : never;
}) {
  const entries = [
    { label: labels.trendScore, value: scores.trendScore },
    { label: labels.brandFit, value: scores.brandFit },
    { label: labels.commercialPotential, value: scores.commercialPotential },
    { label: labels.competition, value: scores.competition },
    { label: labels.longevity, value: scores.longevity },
    { label: labels.originality, value: scores.originality },
  ];

  return (
    <div className="rs3-brief-score-grid">
      {entries.map((entry) => (
        <div key={entry.label} className="rs3-brief-score-item">
          <span className="rs3-brief-score-label">{entry.label}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ResearchStudioCreativeBrief({
  brief,
  generatedAt,
  embedded = false,
}: ResearchStudioCreativeBriefProps) {
  const router = useRouter();
  const { research } = useDictionary();
  const cb = research.studio.creativeBrief;
  const [opening, setOpening] = useState(false);

  const handleOpenDesignStudio = () => {
    setOpening(true);
    saveFusionCreativeBriefHandoff(brief, generatedAt);
    activateFusionHandoffInDesignStudio(brief, generatedAt);
    router.push("/agents/design");
  };

  return (
    <section
      className={cn(
        "rs3-fusion-section rs3-fusion-section-brief",
        embedded && "rs3-fusion-section-embedded",
      )}
    >
      {!embedded ? (
        <header className="rs3-fusion-section-head">
          <FileText className="size-4" />
          <h3>{cb.title}</h3>
        </header>
      ) : null}

      <div className="rs3-brief-hero">
        <p className="rs3-brief-eyebrow">{cb.conceptName}</p>
        <h4 className="rs3-brief-concept-name">{brief.conceptName}</h4>
        {brief.anchorOpportunityTitle ? (
          <p className="rs3-brief-anchor">
            {cb.anchoredOn} {brief.anchorOpportunityTitle}
          </p>
        ) : null}
      </div>

      <div className="rs3-brief-block">
        <h5>{cb.executiveSummary}</h5>
        <p>{brief.executiveSummary}</p>
      </div>

      <div className="rs3-brief-block">
        <h5>{cb.businessCase}</h5>
        <p>{brief.businessCase}</p>
      </div>

      <BriefScoreGrid scores={brief.scores} labels={cb.scores} />

      <div className="rs3-brief-columns">
        <div className="rs3-brief-block">
          <h5>{cb.targetAudience}</h5>
          <BriefList items={brief.targetAudience} />
        </div>

        <div className="rs3-brief-block">
          <h5>{cb.recommendedProduct}</h5>
          <p className="rs3-brief-highlight">{brief.recommendedProduct}</p>
          <h5>{cb.alternativeProducts}</h5>
          <BriefList items={brief.alternativeProducts} />
        </div>
      </div>

      <div className="rs3-brief-columns">
        <div className="rs3-brief-block">
          <h5>{cb.recommendedPlacement}</h5>
          <BriefList items={brief.recommendedPlacement} />
        </div>

        <div className="rs3-brief-block">
          <h5>{cb.printTechnique}</h5>
          <BriefList items={brief.printTechnique} />
        </div>
      </div>

      <div className="rs3-brief-columns">
        <div className="rs3-brief-block">
          <h5>{cb.typographyDirection}</h5>
          <BriefList items={brief.typographyDirection} />
        </div>

        <div className="rs3-brief-block">
          <h5>{cb.graphicDirection}</h5>
          <BriefList items={brief.graphicDirection} />
        </div>
      </div>

      <div className="rs3-brief-columns">
        <div className="rs3-brief-block">
          <h5>{cb.colorPalette}</h5>
          <div className="rs3-brief-tags">
            {brief.colorPalette.map((color) => (
              <span key={color} className="rs3-brief-tag">
                {color}
              </span>
            ))}
          </div>
        </div>

        <div className="rs3-brief-block">
          <h5>{cb.materialRecommendation}</h5>
          <BriefList items={brief.materialRecommendation} />
        </div>
      </div>

      <div className="rs3-brief-block">
        <h5>{cb.productionNotes}</h5>
        <p>{brief.productionNotes}</p>
      </div>

      <div className="rs3-brief-block rs3-brief-avoid">
        <h5>{cb.doNotUse}</h5>
        <div className="rs3-brief-tags">
          {brief.avoid.map((item) => (
            <span key={item} className="rs3-brief-tag rs3-brief-tag-avoid">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="rs3-brief-block">
        <h5>{cb.researchEvidence}</h5>
        <div className="rs3-brief-tags">
          {brief.researchEvidence.map((source) => (
            <span key={source} className="rs3-brief-tag rs3-brief-tag-evidence">
              {source}
            </span>
          ))}
        </div>
      </div>

      <footer className="rs3-brief-footer">
        <div>
          <p className="rs3-brief-next-label">{cb.nextStep}</p>
          <p className="rs3-brief-next-value">{brief.nextStep}</p>
        </div>
        <button
          type="button"
          className={cn("rs3-brief-cta", opening && "rs3-brief-cta-loading")}
          onClick={handleOpenDesignStudio}
          disabled={opening}
        >
          {opening ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {cb.opening}
            </>
          ) : (
            <>
              <ArrowRight className="size-4" />
              {cb.openInDesignStudio}
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
