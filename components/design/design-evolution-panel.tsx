"use client";

import type { DesignDirection, EvolutionAction } from "@/lib/design/design-directions";
import { cn } from "@/lib/utils";
import { GitBranch, Sparkles, Wand2 } from "lucide-react";

interface DesignEvolutionPanelProps {
  direction: DesignDirection;
  otherDirections: DesignDirection[];
  onEvolve: (action: EvolutionAction) => void;
  onBlend: (secondaryId: string) => void;
  disabled?: boolean;
}

const EVOLUTION_ACTIONS: Array<{ action: EvolutionAction; label: string }> = [
  { action: "more-luxury", label: "Explore More Luxury" },
  { action: "reduce-typography", label: "Reduce Typography" },
  { action: "increase-emotion", label: "Increase Emotion" },
  { action: "more-premium", label: "More Premium" },
  { action: "more-editorial", label: "More Editorial" },
  { action: "more-graphic", label: "More Graphic" },
  { action: "more-minimal", label: "More Minimal" },
  { action: "more-vintage", label: "More Vintage" },
  { action: "version-2", label: "Create Version 2" },
  { action: "version-3", label: "Create Version 3" },
  { action: "alt-composition", label: "Generate Alternative Composition" },
];

export function DesignEvolutionPanel({
  direction,
  otherDirections,
  onEvolve,
  onBlend,
  disabled,
}: DesignEvolutionPanelProps) {
  const blendCandidates = otherDirections.filter(
    (d) => !d.archived && d.id !== direction.id,
  );

  return (
    <section className="cs-evolution-panel" aria-label="Design evolution">
      <header className="cs-evolution-head">
        <Wand2 className="size-4 text-[#d9b46b]" />
        <div>
          <h3>Design Evolution</h3>
          <p>Refine {direction.title} — Creative Source V1</p>
        </div>
      </header>

      <div className="cs-evolution-actions">
        {EVOLUTION_ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            className="cs-evolution-chip"
            disabled={disabled}
            onClick={() => onEvolve(action)}
          >
            <Sparkles className="size-3" />
            {label}
          </button>
        ))}
      </div>

      {blendCandidates.length > 0 ? (
        <div className="cs-evolution-blend">
          <header>
            <GitBranch className="size-3.5" />
            <span>Blend With</span>
          </header>
          <div className="cs-evolution-blend-actions">
            {blendCandidates.slice(0, 4).map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={cn("cs-evolution-chip", "cs-evolution-chip--blend")}
                disabled={disabled}
                onClick={() => onBlend(candidate.id)}
              >
                Blend With {candidate.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
