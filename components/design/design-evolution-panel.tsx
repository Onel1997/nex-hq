"use client";

import type { DesignDirection, EvolutionAction } from "@/lib/design/design-directions";
import { cn } from "@/lib/utils";
import { Loader2, MessageSquare, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";

interface DesignEvolutionPanelProps {
  direction: DesignDirection;
  onEvolve: (action: EvolutionAction) => void;
  onRevision: (prompt: string) => void;
  revisionLoading?: boolean;
  disabled?: boolean;
}

const COLLABORATION_CHIPS: Array<{ label: string; action?: EvolutionAction; prompt?: string }> = [
  { label: "Create Version 2", action: "version-2" },
  { label: "More Premium", action: "more-luxury" },
  { label: "More Minimal", action: "more-minimal" },
  { label: "Increase Emotion", action: "increase-emotion" },
  { label: "Reduce Typography", action: "reduce-typography" },
  { label: "Improve Balance", action: "alt-composition" },
  { label: "Increase Fashion Value", action: "more-premium" },
];

export function DesignEvolutionPanel({
  direction,
  onEvolve,
  onRevision,
  revisionLoading,
  disabled,
}: DesignEvolutionPanelProps) {
  const [feedback, setFeedback] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = feedback.trim();
    if (!trimmed || revisionLoading) return;
    onRevision(trimmed);
    setFeedback("");
  };

  return (
    <section className="cs-collaboration" aria-label="Creative collaboration">
      <header className="cs-collaboration-head">
        <Wand2 className="size-3.5 text-[#52c2c2]" />
        <div>
          <h3>Creative Collaboration</h3>
          <p>Refine with your Art Director · {direction.title}</p>
        </div>
      </header>

      <div className="cs-collaboration-chips">
        {COLLABORATION_CHIPS.map(({ label, action, prompt }) => (
          <button
            key={label}
            type="button"
            className="cs-collaboration-chip"
            disabled={disabled || revisionLoading}
            onClick={() => {
              if (action) onEvolve(action);
              else if (prompt) onRevision(prompt);
            }}
          >
            <Sparkles className="size-3" />
            {label}
          </button>
        ))}
      </div>

      <form className="cs-collaboration-input" onSubmit={handleSubmit}>
        <input
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Custom feedback for the Art Director…"
          disabled={disabled || revisionLoading}
        />
        <button type="submit" disabled={disabled || revisionLoading || !feedback.trim()}>
          {revisionLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MessageSquare className="size-3.5" />
          )}
        </button>
      </form>
    </section>
  );
}
