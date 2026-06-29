import type {
  DesignStyleId,
  LayoutId,
  OrnamentId,
  SymbolId,
  TemplateId,
} from "@/lib/design/design-library/types";
import type { MovementStyle } from "@/lib/design/design-knowledge/types";

export type EmotionalLanguageId =
  | "reflection"
  | "faith"
  | "silence"
  | "distance"
  | "hope"
  | "memory"
  | "connection"
  | "isolation"
  | "strength"
  | "freedom"
  | "growth"
  | "loss"
  | "purpose"
  | "identity"
  | "legacy";

export type TypographyBehavior =
  | "soft-oversized"
  | "ghost-layer"
  | "micro-coordinates"
  | "cropped-stack"
  | "whisper-scale"
  | "vertical-rail"
  | "museum-caption"
  | "statement-dominant";

export type OrnamentDensity = "bare" | "sparse" | "moderate" | "rich";

export type NegativeSpaceProfile = "high" | "elevated" | "balanced" | "tight";

export type CompositionRhythm = "still" | "measured" | "pulse" | "cascade" | "tension";

export interface EmotionalLanguage {
  id: EmotionalLanguageId;
  name: string;
  mood: string;
  /** 0–1 material restraint */
  restraint: number;
  typographyBehaviors: TypographyBehavior[];
  ornamentDensity: OrnamentDensity;
  symbolPreferences: SymbolId[];
  negativeSpaceProfile: NegativeSpaceProfile;
  compositionRhythm: CompositionRhythm;
  movement: MovementStyle;
  templateBias: TemplateId[];
  layoutBias: LayoutId[];
  styleBias: DesignStyleId[];
  ornamentPreferences: OrnamentId[];
  keywords: string[];
}

export interface EmotionTranslation {
  typography: TypographyBehavior[];
  symbols: SymbolId[];
  ornaments: OrnamentId[];
  negativeSpace: NegativeSpaceProfile;
  movement: MovementStyle;
  templateHints: TemplateId[];
  layoutHints: LayoutId[];
  narrative: string;
}

export interface EmotionalDirectorDecision {
  primary: EmotionalLanguageId;
  secondary: EmotionalLanguageId;
  confidence: number;
  reason: string;
  translation: EmotionTranslation;
}

export interface EmotionalCompositionWeights {
  templates: Partial<Record<TemplateId, number>>;
  layouts: Partial<Record<LayoutId, number>>;
  styles: Partial<Record<DesignStyleId, number>>;
  symbols: Partial<Record<SymbolId, number>>;
  ornaments: Partial<Record<OrnamentId, number>>;
  negativeSpaceMultiplier: number;
  ornamentCountCap: number;
  movement: MovementStyle;
}
