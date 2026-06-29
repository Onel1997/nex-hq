export type {
  CompositionRhythm,
  EmotionalCompositionWeights,
  EmotionalDirectorDecision,
  EmotionalLanguage,
  EmotionalLanguageId,
  EmotionTranslation,
  NegativeSpaceProfile,
  OrnamentDensity,
  TypographyBehavior,
} from "@/lib/design/design-knowledge/emotional-language/types";

export {
  EMOTIONAL_LANGUAGES,
  getAllEmotionalLanguages,
  getEmotionalLanguage,
} from "@/lib/design/design-knowledge/emotional-language/emotion-library";

export {
  decideEmotionalDirection,
  selectEmotionsFromBrief,
} from "@/lib/design/design-knowledge/emotional-language/emotion-selector";

export {
  formatEmotionTranslation,
  translateEmotions,
} from "@/lib/design/design-knowledge/emotional-language/emotion-translation";

export {
  applyEmotionLayoutScore,
  applyEmotionStyleScore,
  applyEmotionTemplateScore,
  applyEmotionalTypography,
  buildEmotionalWeights,
  effectiveNegativeSpace,
  emotionRevisionOverrides,
  evaluateEmotionCompositionMatch,
  rankEmotionOrnaments,
  rankEmotionSymbols,
  type EmotionCompositionMatch,
} from "@/lib/design/design-knowledge/emotional-language/emotion-rules";
