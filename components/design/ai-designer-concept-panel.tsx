"use client";

import type {
  DesignConcept,
  DesignConceptReview,
  RenderPlan,
} from "@/lib/design/ai-designer/types";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Copy,
  Frame,
  Gem,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Shapes,
  Sparkles,
  TrendingUp,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

const SECTIONS_STORAGE_KEY = "nexhq-design-inspector-sections";

const DEFAULT_SECTION_OPEN: Record<string, boolean> = {
  "creative-direction": true,
  "design-story": false,
  "fashion-language": false,
  typography: false,
  symbols: false,
  ornaments: false,
  "commercial-intention": false,
  "image-prompt": true,
  "mockup-prompt": false,
  "render-deliverables": false,
  "blueprint-review": true,
};

interface AiDesignerConceptPanelProps {
  concept?: DesignConcept;
  renderPlan?: RenderPlan;
  review?: DesignConceptReview;
  onSendToImageStudio?: () => void;
  onCopyImagePrompt?: () => void;
  onGenerateConcept?: () => void;
  actionLoading?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function loadSectionState(): Record<string, boolean> {
  if (typeof window === "undefined") return DEFAULT_SECTION_OPEN;
  try {
    const raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_SECTION_OPEN;
    return { ...DEFAULT_SECTION_OPEN, ...(JSON.parse(raw) as Record<string, boolean>) };
  } catch {
    return DEFAULT_SECTION_OPEN;
  }
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  "creative-direction": Compass,
  "design-story": BookOpen,
  "fashion-language": Layers,
  typography: Type,
  symbols: Shapes,
  ornaments: Gem,
  "commercial-intention": TrendingUp,
  "image-prompt": ImageIcon,
  "mockup-prompt": Frame,
  "render-deliverables": Package,
  "blueprint-review": ClipboardCheck,
};

function InspectorSection({
  id,
  title,
  meta,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  icon?: LucideIcon;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  const SectionIcon = Icon ?? SECTION_ICONS[id];

  return (
    <div className={cn("cw-inspector-card", open && "is-open")}>
      <button
        type="button"
        className="cw-inspector-card-header"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <span className="cw-inspector-card-leading">
          {SectionIcon ? (
            <span className="cw-inspector-card-icon-wrap" aria-hidden>
              <SectionIcon className="cw-inspector-card-icon" />
            </span>
          ) : null}
          <span className="cw-inspector-card-heading">
            <span className="cw-inspector-card-title">{title}</span>
            {meta ? <span className="cw-inspector-card-meta">{meta}</span> : null}
          </span>
        </span>
        <ChevronDown className={cn("cw-inspector-chevron", open && "is-open")} />
      </button>
      <div className="cw-inspector-card-body-wrap" aria-hidden={!open}>
        <div className="cw-inspector-card-body">{children}</div>
      </div>
    </div>
  );
}

function InspectorCopy({ text }: { text: string }) {
  return <p className="cw-inspector-copy">{text}</p>;
}

function InspectorList({ items }: { items: string[] }) {
  return (
    <ul className="cw-inspector-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function InspectorPrompt({ text }: { text: string }) {
  return <pre className="cw-inspector-prompt">{text}</pre>;
}

export function AiDesignerConceptPanel({
  concept,
  renderPlan,
  review,
  onSendToImageStudio,
  onCopyImagePrompt,
  onGenerateConcept,
  actionLoading,
  collapsed = false,
  onToggleCollapse,
}: AiDesignerConceptPanelProps) {
  const [sections, setSections] = useState<Record<string, boolean>>(loadSectionState);

  const toggleSection = useCallback((id: string) => {
    setSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (typeof window !== "undefined") {
        localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const isOpen = (id: string) => sections[id] ?? DEFAULT_SECTION_OPEN[id] ?? false;

  if (collapsed) {
    return (
      <aside className="cw-inspector cw-inspector-collapsed" aria-label="AI Designer inspector">
        <button
          type="button"
          className="cw-inspector-expand"
          onClick={onToggleCollapse}
          aria-label="Open AI Designer inspector"
        >
          <PanelRightOpen className="size-4" />
          <span>Concept</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="cw-inspector" aria-label="AI Designer inspector">
      <header className="cw-inspector-header">
        <div>
          <p className="cw-inspector-eyebrow">Inspector</p>
          <h2 className="cw-inspector-title">AI Designer</h2>
        </div>
        <button
          type="button"
          className="cw-inspector-collapse"
          onClick={onToggleCollapse}
          aria-label="Collapse inspector"
        >
          <PanelRightClose className="size-4" />
        </button>
      </header>

      {!concept ? (
        <div className="cw-inspector-empty">
          <Sparkles className="cw-inspector-empty-icon" />
          <p className="cw-inspector-empty-title">AI Designer</p>
          <p className="cw-inspector-empty-copy">
            Generate a premium fashion concept to begin.
          </p>
          <button
            type="button"
            className="cw-toolbar-btn cw-btn-primary"
            disabled={actionLoading === "Generate AI Design Concept"}
            onClick={onGenerateConcept}
          >
            {actionLoading === "Generate AI Design Concept" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>Generate AI Design Concept</span>
          </button>
        </div>
      ) : (
        <div className="cw-inspector-scroll">
          {review?.readyForImageStudio ? (
            <div className="cw-inspector-handoff">
              <p>Ready for Image Studio</p>
              <div className="cw-inspector-handoff-actions">
                <button
                  type="button"
                  className="cw-toolbar-btn cw-btn-primary"
                  onClick={onSendToImageStudio}
                >
                  <Send className="size-3.5" />
                  <span>Send to Image Studio</span>
                </button>
                <button
                  type="button"
                  className="cw-toolbar-btn cw-btn-secondary"
                  onClick={onCopyImagePrompt}
                >
                  <Copy className="size-3.5" />
                  <span>Copy Prompt</span>
                </button>
              </div>
            </div>
          ) : null}

          <InspectorSection
            id="creative-direction"
            title="Creative Direction"
            meta={concept.creativeDirection.mood}
            open={isOpen("creative-direction")}
            onToggle={toggleSection}
          >
            <InspectorCopy text={concept.creativeDirection.summary} />
            <p className="cw-inspector-muted">
              {concept.creativeDirection.emotion} · {concept.creativeDirection.fashionSystem}
            </p>
          </InspectorSection>

          <InspectorSection
            id="design-story"
            title="Design Story"
            open={isOpen("design-story")}
            onToggle={toggleSection}
          >
            <InspectorCopy text={concept.designStory} />
          </InspectorSection>

          <InspectorSection
            id="fashion-language"
            title="Fashion Language"
            meta={concept.fashionLanguage.garmentScale}
            open={isOpen("fashion-language")}
            onToggle={toggleSection}
          >
            <InspectorList items={concept.fashionLanguage.principles.slice(0, 4)} />
          </InspectorSection>

          <InspectorSection
            id="typography"
            title="Typography"
            meta={concept.typographyLanguage.direction}
            open={isOpen("typography")}
            onToggle={toggleSection}
          >
            <InspectorCopy text={concept.typographyLanguage.headlineTreatment} />
            <p className="cw-inspector-muted">{concept.typographyLanguage.compositionShare}</p>
            <InspectorList items={concept.typographyLanguage.behaviors} />
          </InspectorSection>

          <InspectorSection
            id="symbols"
            title="Symbols"
            open={isOpen("symbols")}
            onToggle={toggleSection}
          >
            <InspectorCopy text={concept.symbolLanguage.system} />
            <p className="cw-inspector-muted">{concept.symbolLanguage.primarySymbols.join(" · ")}</p>
          </InspectorSection>

          <InspectorSection
            id="ornaments"
            title="Ornaments"
            meta={concept.ornamentLanguage.density}
            open={isOpen("ornaments")}
            onToggle={toggleSection}
          >
            <InspectorCopy text={concept.ornamentLanguage.system} />
          </InspectorSection>

          <InspectorSection
            id="commercial-intention"
            title="Commercial Intention"
            meta={concept.commercialIntention.priceBand}
            open={isOpen("commercial-intention")}
            onToggle={toggleSection}
          >
            <InspectorCopy text={concept.commercialIntention.buyerHook} />
            <InspectorList items={concept.commercialIntention.wouldBuySignals} />
          </InspectorSection>

          <InspectorSection
            id="image-prompt"
            title="Image Prompt"
            open={isOpen("image-prompt")}
            onToggle={toggleSection}
          >
            <InspectorPrompt text={concept.imagePrompt.primary} />
          </InspectorSection>

          <InspectorSection
            id="mockup-prompt"
            title="Mockup Prompt"
            open={isOpen("mockup-prompt")}
            onToggle={toggleSection}
          >
            <InspectorPrompt text={concept.mockupPrompt.primary} />
          </InspectorSection>

          {renderPlan ? (
            <InspectorSection
              id="render-deliverables"
              title="Render Deliverables"
              meta={`${renderPlan.deliverables.length} assets`}
              open={isOpen("render-deliverables")}
              onToggle={toggleSection}
            >
              <ul className="cw-inspector-deliverables">
                {renderPlan.deliverables.map((d) => (
                  <li key={d.kind}>
                    <strong>{d.kind}</strong>
                    <span>{d.aspectRatio}</span>
                    <span className="cw-inspector-muted">{d.notes}</span>
                  </li>
                ))}
              </ul>
            </InspectorSection>
          ) : null}

          {review ? (
            <InspectorSection
              id="blueprint-review"
              title="Blueprint Review"
              meta={`${review.score}/100`}
              open={isOpen("blueprint-review")}
              onToggle={toggleSection}
            >
              <p
                className={cn(
                  "cw-inspector-review-score",
                  review.readyForImageStudio && "is-ready",
                )}
              >
                {review.readyForImageStudio ? "Image Studio ready" : "Review in progress"} ·{" "}
                {review.score}/100
              </p>
              {review.strengths.length > 0 ? (
                <InspectorList items={review.strengths} />
              ) : null}
            </InspectorSection>
          ) : null}
        </div>
      )}
    </aside>
  );
}
