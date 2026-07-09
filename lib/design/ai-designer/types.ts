import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { EmotionalDirectorDecision } from "@/lib/design/design-knowledge/emotional-language/types";
import type { HeroTypographyDirectorDecision } from "@/lib/design/design-knowledge/hero-typography/types";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability";
import type { NegativeSpaceProfile } from "@/lib/design/design-knowledge/emotional-language/types";

/* ── Language profiles ───────────────────────────────────────── */

export interface FashionLanguageProfile {
  principles: string[];
  mood: string;
  stylingNotes: string[];
  antiPatterns: string[];
  garmentScale: string;
  luxurySignals: string[];
}

export interface CompositionLanguageProfile {
  pattern: string;
  focalStrategy: string;
  balance: string;
  movement: string;
  depthLayers: number;
  overlap: boolean;
  hierarchy: string;
  placement: string;
}

export interface TypographyLanguageProfile {
  direction: string;
  concepts: string[];
  hierarchy: string;
  behaviors: string[];
  compositionShare: string;
  headlineTreatment: string;
}

export interface SymbolLanguageProfile {
  system: string;
  primarySymbols: string[];
  secondaryGeometry: string[];
  restraint: string;
}

export interface OrnamentLanguageProfile {
  system: string;
  elements: string[];
  density: string;
  restraint: string;
}

export interface NegativeSpaceProfileSpec {
  profile: NegativeSpaceProfile;
  targetRatio: string;
  rules: string[];
  breathingZones: string[];
}

export interface HeroFocusSpec {
  focalPoint: string;
  scrollStopHook: string;
  dominantElement: string;
  supportingElements: string[];
}

export interface CreativeDirectionSpec {
  summary: string;
  mood: string;
  emotion: string;
  collectionRole: string;
  visualIntent: string;
  fashionSystem: string;
}

export interface CommercialIntentionSpec {
  role: string;
  priceBand: string;
  campaignPotential: string;
  buyerHook: string;
  wouldBuySignals: string[];
}

export interface ProductionNotesSpec {
  method: string;
  placement: string;
  dimensions: string;
  colorCount: string;
  materialEffects: string;
  printReadiness: string[];
  qualityGates: string[];
}

export interface PremiumImagePromptSpec {
  /** Full prompt for high-end image generation models. */
  primary: string;
  /** Shorter variant for social / thumbnail generation. */
  social: string;
  /** Campaign hero variant with environment. */
  campaign: string;
  tags: string[];
}

export interface MockupPromptSpec {
  primary: string;
  flatLay: string;
  onModel: string;
  tags: string[];
}

/* ── Core output ─────────────────────────────────────────────── */

/**
 * Complete creative blueprint from the AI Designer.
 * NOT SVG. NOT raster image. Image Studio consumes this later.
 */
export interface DesignConcept {
  designId: string;
  title: string;
  collection: string;
  product: string;
  color: string;
  printArea: string;
  creativeDirection: CreativeDirectionSpec;
  fashionLanguage: FashionLanguageProfile;
  compositionLanguage: CompositionLanguageProfile;
  typographyLanguage: TypographyLanguageProfile;
  symbolLanguage: SymbolLanguageProfile;
  ornamentLanguage: OrnamentLanguageProfile;
  negativeSpaceProfile: NegativeSpaceProfileSpec;
  heroFocus: HeroFocusSpec;
  designStory: string;
  commercialIntention: CommercialIntentionSpec;
  imagePrompt: PremiumImagePromptSpec;
  mockupPrompt: MockupPromptSpec;
  productionNotes: ProductionNotesSpec;
  /** Confidence that the blueprint is complete and premium-ready (0–100). */
  confidence: number;
  /** ISO timestamp of concept generation. */
  generatedAt: string;
}

/* ── Input ───────────────────────────────────────────────────── */

export interface ResearchContext {
  reportId?: string;
  reportTitle?: string;
  collectionName?: string;
  visualConcept?: string;
  designDescription?: string;
  dnaScore?: number;
  campaignPotential?: string;
}

export interface CommercialDirectionInput {
  role: string;
  intention: string;
  campaignPotential?: string;
  priceBand?: string;
}

/** All upstream intelligence the AI Designer synthesizes. */
export interface AiDesignerInput {
  /** Primary garment brief — required unless research context is complete. */
  brief?: DesignStudioBrief;
  research?: ResearchContext;
  creativeDirector?: CreativeDirectorDecision;
  emotion?: EmotionalDirectorDecision;
  wearability?: WearabilityDirectorDecision;
  typographyDirection?: HeroTypographyDirectorDecision;
  commercialDirection?: CommercialDirectionInput;
  collection?: { id: string; name: string; mood?: string };
  mood?: string;
  seed?: number;
}

/* ── Render plan (future Image Studio handoff) ───────────────── */

export type RenderDeliverableKind =
  | "concept-visualization"
  | "product-mockup"
  | "campaign-hero"
  | "social-asset-4-5"
  | "social-asset-1-1"
  | "lookbook-still";

export interface RenderDeliverable {
  kind: RenderDeliverableKind;
  prompt: string;
  aspectRatio: string;
  priority: "primary" | "secondary";
  notes: string;
}

export interface RenderPlan {
  conceptId: string;
  deliverables: RenderDeliverable[];
  /** Ordered pipeline — Image Studio executes these in sequence. */
  pipeline: string[];
  handoffNotes: string[];
}

/* ── Review ──────────────────────────────────────────────────── */

export interface DesignConceptReview {
  passed: boolean;
  score: number;
  strengths: string[];
  gaps: string[];
  readyForImageStudio: boolean;
  readyForCommercialReview: boolean;
}

/* ── Pipeline result ───────────────────────────────────────────── */

export interface AiDesignerResult {
  concept: DesignConcept;
  renderPlan: RenderPlan;
  review: DesignConceptReview;
  /** Resolved upstream decisions used during synthesis. */
  resolved: {
    creativeDirector: CreativeDirectorDecision;
    emotion?: EmotionalDirectorDecision;
    wearability?: WearabilityDirectorDecision;
    typographyDirection?: HeroTypographyDirectorDecision;
  };
}
