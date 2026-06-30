"use client";

import { DesignLabCollapse } from "@/components/design/design-lab-workspace";
import type {
  DesignConcept,
  DesignConceptReview,
  RenderPlan,
} from "@/lib/design/ai-designer/types";
import { cn } from "@/lib/utils";
import { Copy, Send } from "lucide-react";
import type { ReactNode } from "react";

interface AiDesignerConceptPanelProps {
  concept?: DesignConcept;
  renderPlan?: RenderPlan;
  review?: DesignConceptReview;
  onSendToImageStudio?: () => void;
  onCopyImagePrompt?: () => void;
}

function ConceptBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cw-ai-concept-block">
      <h4>{title}</h4>
      <div className="cw-ai-concept-block-body">{children}</div>
    </div>
  );
}

function PromptBlock({ text }: { text: string }) {
  return <pre className="cw-ai-concept-prompt">{text}</pre>;
}

export function AiDesignerConceptPanel({
  concept,
  renderPlan,
  review,
  onSendToImageStudio,
  onCopyImagePrompt,
}: AiDesignerConceptPanelProps) {
  if (!concept) return null;

  const readyForImageStudio = review?.readyForImageStudio === true;
  const reviewMeta = review
    ? `Review ${review.score}/100 · Image Studio ${review.readyForImageStudio ? "ready" : "pending"}`
    : undefined;

  return (
    <section className="cw-ai-concept-span" aria-label="AI Designer concept">
      <DesignLabCollapse
        title="AI Design Concept"
        meta={reviewMeta ?? concept.collection}
        defaultOpen
      >
        {readyForImageStudio ? (
          <div className="cw-ai-concept-handoff">
            <p className="cw-ai-concept-handoff-status">
              AI Design Concept ready for Image Studio
            </p>
            <div className="cw-ai-concept-handoff-actions">
              <button
                type="button"
                className="cw-toolbar-btn cw-btn-primary"
                onClick={onSendToImageStudio}
              >
                <Send className="size-3.5" />
                <span>Send AI Concept to Image Studio</span>
              </button>
              <button
                type="button"
                className="cw-toolbar-btn cw-btn-secondary"
                onClick={onCopyImagePrompt}
              >
                <Copy className="size-3.5" />
                <span>Copy Image Prompt</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="cw-ai-concept-grid">
          <ConceptBlock title="Creative Direction">
            <p>{concept.creativeDirection.summary}</p>
            <p className="cw-ai-concept-muted">
              {concept.creativeDirection.mood} · {concept.creativeDirection.emotion} ·{" "}
              {concept.creativeDirection.fashionSystem}
            </p>
          </ConceptBlock>

          <ConceptBlock title="Design Story">
            <p>{concept.designStory}</p>
          </ConceptBlock>

          <ConceptBlock title="Fashion Language">
            <ul>
              {concept.fashionLanguage.principles.slice(0, 4).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="cw-ai-concept-muted">{concept.fashionLanguage.garmentScale}</p>
          </ConceptBlock>

          <ConceptBlock title="Typography Language">
            <p>{concept.typographyLanguage.headlineTreatment}</p>
            <p className="cw-ai-concept-muted">
              {concept.typographyLanguage.direction} · {concept.typographyLanguage.compositionShare}
            </p>
            <ul>
              {concept.typographyLanguage.behaviors.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </ConceptBlock>

          <ConceptBlock title="Symbol Language">
            <p>{concept.symbolLanguage.system}</p>
            <p>{concept.symbolLanguage.primarySymbols.join(" · ")}</p>
            <p className="cw-ai-concept-muted">{concept.symbolLanguage.restraint}</p>
          </ConceptBlock>

          <ConceptBlock title="Ornament Language">
            <p>{concept.ornamentLanguage.system}</p>
            <p className="cw-ai-concept-muted">
              {concept.ornamentLanguage.density} · {concept.ornamentLanguage.restraint}
            </p>
          </ConceptBlock>

          <ConceptBlock title="Commercial Intention">
            <p>{concept.commercialIntention.buyerHook}</p>
            <p className="cw-ai-concept-muted">
              {concept.commercialIntention.role} · {concept.commercialIntention.priceBand}
            </p>
            <ul>
              {concept.commercialIntention.wouldBuySignals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </ConceptBlock>

          <ConceptBlock title="Image Prompt">
            <PromptBlock text={concept.imagePrompt.primary} />
          </ConceptBlock>

          <ConceptBlock title="Mockup Prompt">
            <PromptBlock text={concept.mockupPrompt.primary} />
          </ConceptBlock>

          {renderPlan ? (
            <ConceptBlock title="Render Deliverables">
              <ul className="cw-ai-concept-deliverables">
                {renderPlan.deliverables.map((d) => (
                  <li key={d.kind}>
                    <strong>{d.kind}</strong>
                    <span>{d.aspectRatio}</span>
                    <span className="cw-ai-concept-muted">{d.notes}</span>
                  </li>
                ))}
              </ul>
            </ConceptBlock>
          ) : null}

          {review ? (
            <ConceptBlock title="Blueprint Review">
              <p
                className={cn(
                  "cw-ai-concept-review-score",
                  review.readyForImageStudio && "is-ready",
                )}
              >
                Score {review.score}/100 · readyForImageStudio:{" "}
                {review.readyForImageStudio ? "yes" : "no"}
              </p>
              {review.strengths.length > 0 ? (
                <ul>
                  {review.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </ConceptBlock>
          ) : null}
        </div>
      </DesignLabCollapse>
    </section>
  );
}
