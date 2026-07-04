"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  CreativeDirectorMessage,
  DesignHealthScores,
  DesignIteration,
  DesignMissionAssets,
  DesignVersionEntry,
} from "@/lib/design/design-mission-store";
import type { DesignConcept, DesignConceptReview, RenderPlan } from "@/lib/design/ai-designer/types";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";
import { CommercialReviewMeters } from "@/components/design/commercial-review-meters";
import { DesignLabCollapse } from "@/components/design/design-lab-workspace";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ClipboardList,
  History,
  Loader2,
  MessageSquare,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

const REVISION_BUTTONS = [
  { label: "More Luxury", prompt: "Make typography more premium and increase the luxury feeling" },
  { label: "Reduce Typography", prompt: "Reduce visual weight and simplify typography" },
  { label: "Increase Emotion", prompt: "Increase emotional impact and editorial presence" },
  { label: "More Minimal", prompt: "Increase negative space and reduce ornament density" },
  { label: "More Editorial", prompt: "Make the composition more editorial and refined" },
  { label: "Increase Contrast", prompt: "Increase contrast and visual punch for scroll-stop" },
  { label: "Increase Fashion Value", prompt: "Elevate fashion value and premium positioning" },
  { label: "Create Version 2", prompt: "Create a refined Version 2 with elevated restraint" },
  { label: "Create Version 3", prompt: "Create an editorial Version 3 with asymmetric layout" },
] as const;

function InspectorSection({
  id,
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  icon: typeof Sparkles;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("cs-inspector-section", open && "is-open")}>
      <button
        type="button"
        className="cs-inspector-section-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <Icon className="size-3.5" />
          {title}
        </span>
        <ChevronDown className={cn("size-3.5 cs-inspector-chevron", open && "is-open")} />
      </button>
      {open ? <div className="cs-inspector-section-body">{children}</div> : null}
    </section>
  );
}

interface StudioInspectorProps {
  brief: DesignStudioBrief;
  concept?: DesignConcept;
  review?: DesignConceptReview;
  renderPlan?: RenderPlan;
  assets: DesignMissionAssets;
  health: DesignHealthScores;
  masterArtworkView: MasterArtworkViewModel;
  commercialScore?: number;
  collectionName?: string;
  versionHistory: DesignVersionEntry[];
  activeIteration: DesignIteration;
  messages: CreativeDirectorMessage[];
  chatInput: string;
  chatLoading: boolean;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  onRevision: (prompt: string) => void;
  advancedTools?: ReactNode;
}

export function StudioInspector({
  brief,
  concept,
  review,
  renderPlan,
  assets,
  health,
  masterArtworkView,
  commercialScore,
  collectionName,
  versionHistory,
  activeIteration,
  messages,
  chatInput,
  chatLoading,
  onChatInputChange,
  onSendChat,
  onRevision,
  advancedTools,
}: StudioInspectorProps) {
  const directorInsights = concept
    ? [
        concept.creativeDirection.summary,
        `Luxury: ${concept.fashionLanguage.luxurySignals.slice(0, 2).join(", ")}`,
        `Typography: ${concept.typographyLanguage.direction}`,
        `Composition: ${concept.compositionLanguage.balance}`,
      ]
    : ["Generate a concept to unlock director insights."];

  const copyPrompt = useCallback(() => {
    const prompt = concept?.imagePrompt.primary ?? brief.imagePrompt;
    void navigator.clipboard.writeText(prompt);
  }, [brief.imagePrompt, concept?.imagePrompt.primary]);

  return (
    <aside className="cs-sidebar cs-sidebar-right" aria-label="Inspector">
      <header className="cs-inspector-top">
        <h2>Inspector</h2>
      </header>

      <div className="cs-inspector-scroll">
        <InspectorSection id="commercial" title="Commercial Review" icon={Sparkles} defaultOpen>
          <CommercialReviewMeters
            health={health}
            concept={concept}
            masterArtworkView={masterArtworkView}
            commercialScore={commercialScore}
          />
        </InspectorSection>

        <InspectorSection id="director" title="Creative Director" icon={Wand2} defaultOpen>
          <div className="cs-inspector-insights">
            {directorInsights.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="cs-inspector-subhead">Quick Revisions</p>
          <div className="cs-revision-chips">
            {REVISION_BUTTONS.map((button) => (
              <button
                key={button.label}
                type="button"
                className="cs-revision-chip"
                onClick={() => onRevision(button.prompt)}
              >
                {button.label}
              </button>
            ))}
          </div>
        </InspectorSection>

        <InspectorSection id="versions" title="Version Notes" icon={ClipboardList}>
          <ul className="cs-version-notes">
            {versionHistory.slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <span>{entry.label}</span>
                <time>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </li>
            ))}
            {versionHistory.length === 0 ? <li className="cs-muted">No version events yet.</li> : null}
          </ul>
          <p className="cs-muted cs-meta-line">
            Active {activeIteration.label} · {review?.score != null ? `${review.score}% blueprint` : "—"}
          </p>
        </InspectorSection>

        <InspectorSection id="prompts" title="Prompt History" icon={History}>
          {concept ? (
            <>
              <pre className="cs-prompt-block">{concept.imagePrompt.primary}</pre>
              <button type="button" className="cs-btn cs-btn-compact" onClick={copyPrompt}>
                Copy image prompt
              </button>
              {renderPlan ? (
                <p className="cs-muted">{renderPlan.deliverables.length} render deliverables planned.</p>
              ) : null}
            </>
          ) : (
            <p className="cs-muted">Prompts appear after concept generation.</p>
          )}
        </InspectorSection>

        <InspectorSection id="chat" title="Chat" icon={MessageSquare}>
          <div className="cs-chat-thread">
            {messages.map((message) => (
              <div key={message.id} className={cn("cs-chat-msg", message.role)}>
                {message.content}
              </div>
            ))}
            {chatLoading ? (
              <div className="cs-chat-msg assistant">
                <Loader2 className="size-3.5 animate-spin" />
              </div>
            ) : null}
          </div>
          <form
            className="cs-chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              onSendChat();
            }}
          >
            <input
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
              placeholder="Ask Creative Director…"
            />
            <button type="submit" disabled={chatLoading || !chatInput.trim()}>
              <MessageSquare className="size-3.5" />
            </button>
          </form>
        </InspectorSection>

        <InspectorSection id="metadata" title="Metadata" icon={ClipboardList}>
          <dl className="cs-meta-grid">
            <div><dt>Collection</dt><dd>{collectionName ?? "—"}</dd></div>
            <div><dt>Version</dt><dd>{activeIteration.label}</dd></div>
            <div><dt>DNA</dt><dd>{brief.dnaScore ?? "—"}%</dd></div>
            <div><dt>Print</dt><dd>{brief.productionMethod}</dd></div>
            <div><dt>Product</dt><dd>{brief.product}</dd></div>
            <div><dt>Color</dt><dd>{brief.color}</dd></div>
          </dl>
          <p className="cs-muted cs-meta-story">{concept?.designStory ?? brief.visualConcept}</p>
        </InspectorSection>

        {advancedTools ? (
          <DesignLabCollapse title="Advanced Tools" meta="SVG · Render · Mockup" defaultOpen={false}>
            {advancedTools}
          </DesignLabCollapse>
        ) : null}
      </div>
    </aside>
  );
}
