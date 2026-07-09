"use client";

import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { DesignStudioBrief, DesignStudioColor } from "@/agents/design/studio-brief";
import { cn } from "@/lib/utils";
import { BookOpen, Palette, Sparkles, Target, Type, Users } from "lucide-react";

interface CreativeBriefVisualProps {
  brief: DesignStudioBrief;
  concept?: DesignConcept;
  collectionName?: string;
  className?: string;
}

function MoodboardTile({
  color,
  label,
  large,
}: {
  color: string;
  label: string;
  large?: boolean;
}) {
  return (
    <div
      className={cn("cw-v2-mood-tile", large && "is-large")}
      style={{ background: `linear-gradient(145deg, ${color}, rgb(0 0 0 / 0.35))` }}
    >
      <span>{label}</span>
    </div>
  );
}

function resolvePaletteColors(brief: DesignStudioBrief): string[] {
  if (brief.colorPalette.length === 0) {
    return [brief.color, "#1a1f2e", "#d9b46b", "#f4f1eb"];
  }

  return brief.colorPalette.map((entry: DesignStudioColor, index) =>
    entry.hex ?? ["#1a1f2e", "#141820", "#d9b46b", "#f4f1eb"][index] ?? brief.color,
  );
}

export function CreativeBriefVisual({
  brief,
  concept,
  collectionName,
  className,
}: CreativeBriefVisualProps) {
  if (!concept) {
    return (
      <section className={cn("cw-v2-brief cw-v2-brief--empty", className)} aria-label="Creative briefing">
        <Sparkles className="cw-v2-brief-empty-icon" />
        <h2>AI Design Concept</h2>
        <p>Visual creative briefing appears after the AI Designer generates a concept.</p>
      </section>
    );
  }

  const palette = resolvePaletteColors(brief);

  const keywords = [
    concept.creativeDirection.fashionSystem,
    concept.fashionLanguage.garmentScale,
    ...concept.fashionLanguage.principles.slice(0, 2),
    concept.commercialIntention.priceBand,
  ].filter(Boolean);

  return (
    <section className={cn("cw-v2-brief", className)} aria-label="Visual creative briefing">
      <header className="cw-v2-brief-header">
        <p className="cw-v2-kicker">AI Designer · Visual Briefing</p>
        <h2 className="cw-v2-brief-title">{concept.title}</h2>
      </header>

      <div className="cw-v2-brief-grid">
        <div className="cw-v2-brief-block cw-v2-brief-moodboard">
          <h3><Palette className="size-3.5" /> Moodboard</h3>
          <div className="cw-v2-moodboard">
            <MoodboardTile color={palette[0] ?? "#1a1f2e"} label="Primary" large />
            <MoodboardTile color={palette[1] ?? "#141820"} label="Depth" />
            <MoodboardTile color={palette[2] ?? "#d9b46b"} label="Accent" />
            <MoodboardTile color={palette[3] ?? "#f4f1eb"} label="Light" />
          </div>
        </div>

        <div className="cw-v2-brief-block">
          <h3><Palette className="size-3.5" /> Color Story</h3>
          <div className="cw-v2-color-story">
            {palette.slice(0, 5).map((color) => (
              <span key={color} className="cw-v2-color-chip" style={{ background: color }} title={color} />
            ))}
          </div>
          <p>{concept.creativeDirection.mood} · {brief.color}</p>
        </div>

        <div className="cw-v2-brief-block">
          <h3><Type className="size-3.5" /> Typography</h3>
          <p className="cw-v2-brief-lead">{concept.typographyLanguage.direction}</p>
          <p>{concept.typographyLanguage.headlineTreatment}</p>
        </div>

        <div className="cw-v2-brief-block">
          <h3><BookOpen className="size-3.5" /> Visual References</h3>
          <ul>
            <li>{concept.compositionLanguage.pattern}</li>
            <li>{concept.symbolLanguage.system}</li>
            <li>{concept.ornamentLanguage.density} ornament density</li>
          </ul>
        </div>

        <div className="cw-v2-brief-block">
          <h3><Sparkles className="size-3.5" /> Style Signals</h3>
          <p>{concept.creativeDirection.visualIntent}</p>
          <p className="cw-v2-brief-muted">{concept.fashionLanguage.luxurySignals.slice(0, 3).join(" · ")}</p>
        </div>

        <div className="cw-v2-brief-block">
          <h3><Users className="size-3.5" /> Target Customer</h3>
          <p>{concept.commercialIntention.buyerHook}</p>
          <p className="cw-v2-brief-muted">{concept.commercialIntention.role}</p>
        </div>

        <div className="cw-v2-brief-block cw-v2-brief-span">
          <h3><BookOpen className="size-3.5" /> Design Story</h3>
          <p>{concept.designStory}</p>
        </div>

        <div className="cw-v2-brief-block">
          <h3><Target className="size-3.5" /> Brand Narrative</h3>
          <p>{concept.creativeDirection.summary}</p>
        </div>

        <div className="cw-v2-brief-block">
          <h3><Sparkles className="size-3.5" /> Collection DNA</h3>
          <p>{collectionName ?? concept.collection}</p>
          <p className="cw-v2-brief-muted">{concept.creativeDirection.collectionRole}</p>
        </div>

        <div className="cw-v2-brief-block cw-v2-brief-span">
          <h3><Target className="size-3.5" /> Fashion Keywords</h3>
          <div className="cw-v2-keyword-row">
            {keywords.map((keyword) => (
              <span key={keyword} className="cw-v2-keyword">{keyword}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
