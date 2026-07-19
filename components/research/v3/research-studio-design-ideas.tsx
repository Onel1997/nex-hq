"use client";

import type { DesignIdea } from "@/lib/research-intelligence/creative-research";
import { activateCreativeHandoffInDesignStudio } from "@/lib/research-intelligence/creative-research/handoff";
import {
  applySelectionToCreativeCopy,
  rejectDesignIdea,
  shortlistDesignIdea,
} from "@/lib/research-intelligence/creative-research";
import { useDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ResearchStudioDesignIdeasProps {
  ideas: DesignIdea[];
  sourceResearchRunId: string;
  selectedIdeaId?: string | null;
  onSelectionChange?: (payload: {
    ideas: DesignIdea[];
    selectedIdeaId: string | null;
    creativeDirectionSummary: string;
    nextStep: string;
  }) => void;
  onVary?: (idea: DesignIdea) => void;
  onSimilar?: (idea: DesignIdea) => void;
}

function difficultyLabel(value: DesignIdea["executionDifficulty"]): string {
  if (value === "low") return "gering";
  if (value === "high") return "hoch";
  return "mittel";
}

export function ResearchStudioDesignIdeas({
  ideas,
  sourceResearchRunId,
  selectedIdeaId = null,
  onSelectionChange,
  onVary,
  onSimilar,
}: ResearchStudioDesignIdeasProps) {
  const router = useRouter();
  const { research } = useDictionary();
  const f = research.studio.fusion;
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [localIdeas, setLocalIdeas] = useState(ideas);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedIdeaId);

  useEffect(() => {
    setLocalIdeas(ideas);
    setLocalSelectedId(selectedIdeaId);
  }, [ideas, selectedIdeaId]);

  const emitSelection = (ideaId: string | null) => {
    const next = applySelectionToCreativeCopy({
      ideas: localIdeas,
      selectedIdeaId: ideaId,
    });
    setLocalIdeas(next.ideas);
    setLocalSelectedId(next.selectedIdeaId);
    onSelectionChange?.(next);
  };

  const handlePrepare = (idea: DesignIdea) => {
    if (idea.status !== "selected" && localSelectedId !== idea.id) {
      emitSelection(idea.id);
    }
    // Mission is persisted only after an explicit selected idea.
    setOpeningId(idea.id);
    const selectedIdea =
      localIdeas.find((item) => item.id === idea.id) ?? idea;
    activateCreativeHandoffInDesignStudio(
      { ...selectedIdea, status: "selected" },
      sourceResearchRunId,
    );
    router.push("/agents/design");
  };

  const selected = localIdeas.find((idea) => idea.status === "selected") ?? null;

  return (
    <section className="rs3-fusion-section rs3-creative-ideas">
      <header className="rs3-fusion-section-head">
        <Sparkles className="size-4" />
        <h3>{f.designIdeas}</h3>
      </header>

      {selected ? (
        <p className="rs3-fusion-body rs3-creative-shortlist">
          {f.shortlist}: „{selected.primaryPhrase}“ — {selected.designTitle}
        </p>
      ) : null}

      <div className="rs3-creative-idea-grid">
        {localIdeas.map((idea) => {
          const isSelected = idea.status === "selected";
          return (
            <article
              key={idea.id}
              className={cn(
                "rs3-creative-idea-card",
                isSelected && "rs3-creative-idea-card-selected",
                idea.status === "rejected" && "rs3-creative-idea-card-rejected",
                idea.status === "shortlisted" && "rs3-creative-idea-card-shortlist",
              )}
            >
              <div className="rs3-creative-idea-card-head">
                <p className="rs3-creative-idea-phrase">„{idea.primaryPhrase}“</p>
                <span className="rs3-creative-idea-status">{idea.status}</span>
              </div>
              <h4 className="rs3-creative-idea-title">{idea.designTitle}</h4>
              <p className="rs3-fusion-body">{idea.designConcept}</p>
              <p className="rs3-creative-idea-alts">{idea.wearReason}</p>

              <div className="rs3-creative-idea-meta">
                <span>
                  {f.product}: {idea.recommendedProductType}
                </span>
                <span>
                  {f.placement}: {idea.placement}
                </span>
                <span>
                  {f.colors}: {[...idea.artworkColors, ...idea.recommendedGarmentColors]
                    .slice(0, 4)
                    .join(", ")}
                </span>
                <span>
                  {f.brandFit}: {idea.brandFitScore}
                </span>
                <span>
                  {f.executionDifficulty}: {difficultyLabel(idea.executionDifficulty)}
                </span>
              </div>

              {idea.alternativePhrases.length > 0 ? (
                <p className="rs3-creative-idea-alts">
                  {f.phrases}: {idea.alternativePhrases.join(" · ")}
                </p>
              ) : null}

              {idea.optionalPatternEvidence && !idea.optionalPatternEvidence.available ? (
                <p className="rs3-creative-idea-honesty">
                  {idea.optionalPatternEvidence.honestyNote ?? f.noPatternEvidence}
                </p>
              ) : null}

              <div className="rs3-creative-idea-actions">
                <button
                  type="button"
                  className="rs3-creative-idea-btn"
                  onClick={() => emitSelection(idea.id)}
                >
                  <Check className="size-3.5" />
                  {f.selectIdea}
                </button>
                <button
                  type="button"
                  className="rs3-creative-idea-btn"
                  onClick={() => {
                    const next = shortlistDesignIdea(localIdeas, idea.id);
                    setLocalIdeas(next);
                  }}
                >
                  {f.shortlist}
                </button>
                <button
                  type="button"
                  className="rs3-creative-idea-btn"
                  onClick={() => {
                    const next = rejectDesignIdea(localIdeas, idea.id);
                    setLocalIdeas(next);
                    if (localSelectedId === idea.id) emitSelection(null);
                  }}
                >
                  <X className="size-3.5" />
                  {f.rejectIdea}
                </button>
                <button
                  type="button"
                  className="rs3-creative-idea-btn"
                  onClick={() => {
                    if (onVary) {
                      onVary(idea);
                      return;
                    }
                    window.dispatchEvent(
                      new CustomEvent("nexhq-creative-research-rerun", {
                        detail: {
                          prompt: `Neu variieren: ${idea.designTitle} — „${idea.primaryPhrase}“. Erzeuge eine neue, unterscheidbare Designidee in derselben emotionalen Richtung.`,
                        },
                      }),
                    );
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  {f.varyIdea}
                </button>
                <button
                  type="button"
                  className="rs3-creative-idea-btn"
                  onClick={() => {
                    if (onSimilar) {
                      onSimilar(idea);
                      return;
                    }
                    window.dispatchEvent(
                      new CustomEvent("nexhq-creative-research-rerun", {
                        detail: {
                          prompt: `Ähnliche Richtung erstellen zu „${idea.primaryPhrase}“ (${idea.designTitle}). Behalte die Designsprache, ändere Spruch und Motiv.`,
                        },
                      }),
                    );
                  }}
                >
                  {f.similarDirection}
                </button>
                <button
                  type="button"
                  className="rs3-creative-idea-btn rs3-creative-idea-btn-primary"
                  onClick={() => handlePrepare(idea)}
                  disabled={!isSelected || openingId === idea.id}
                  title={
                    isSelected
                      ? f.prepareDesignStudio
                      : "Zuerst Idee auswählen"
                  }
                >
                  {openingId === idea.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3.5" />
                  )}
                  {f.prepareDesignStudio}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
