import { analyzeThemeEmotion, analyzeCollectionEmotion, type ThemeEmotionalAnalysis } from "./emotional-intelligence";
import { roundPercent } from "./score-coercion";
import type { DesignConcept, ResearchCollection } from "./types";

export interface EmotionalVisualLanguage {
  emotionalKeyword: string;
  visualSymbols: string[];
  compositionRules: string[];
  spacingRules: string[];
  typographyRules: string[];
  motionLanguage: string[];
  negativeSpaceStrategy: string[];
}

export type EmotionalVisualFamily =
  | "CONNECTION"
  | "DISTANCE"
  | "LONGING"
  | "MEMORY"
  | "ACCEPTANCE"
  | "LOSS";

const VISUAL_FAMILY_LIBRARY: Record<
  EmotionalVisualFamily,
  Omit<EmotionalVisualLanguage, "emotionalKeyword">
> = {
  CONNECTION: {
    visualSymbols: [
      "interlocking forms",
      "overlapping shadows",
      "touching curves",
    ],
    compositionRules: [
      "pair forms in deliberate proximity",
      "allow partial overlap at edges only",
      "maintain readable silhouette at campaign scale",
    ],
    spacingRules: [
      "controlled proximity between elements",
      "12–18 mm gap between paired contours",
    ],
    typographyRules: [
      "single restrained text block maximum",
      "wide tracking, no decorative scripts",
    ],
    motionLanguage: [
      "forms leaning toward each other",
      "subtle directional pull between paired shapes",
    ],
    negativeSpaceStrategy: [
      "frame paired forms with editorial margins",
      "reserve 30% breathing room around the pair",
    ],
  },
  DISTANCE: {
    visualSymbols: [
      "separated elements",
      "empty center space",
      "broken geometry",
      "two separated silhouettes",
    ],
    compositionRules: [
      "avoid central overlap",
      "leave 40% empty area",
      "keep forms apart on a shared axis",
      "never stack elements into a tight cluster",
    ],
    spacingRules: [
      "large margins",
      "wide separation between forms",
      "minimum 24 mm between primary silhouettes",
    ],
    typographyRules: [
      "sparse uppercase only if type is required",
      "no kanji or script-led composition",
    ],
    motionLanguage: [
      "forms drifting apart",
      "unfinished paths that stop before meeting",
    ],
    negativeSpaceStrategy: [
      "empty center space as the emotional subject",
      "negative space must read louder than ink",
    ],
  },
  LONGING: {
    visualSymbols: [
      "unfinished lines",
      "fading forms",
      "disappearing symbols",
      "dissolving edges",
    ],
    compositionRules: [
      "leave paths open or incomplete",
      "fade graphic density toward the edge",
      "avoid closed, resolved shapes",
    ],
    spacingRules: [
      "generous outer margins with inward fade",
      "increasing opacity decay toward the perimeter",
    ],
    typographyRules: [
      "type may trail off or remain absent",
      "no bold resolved wordmarks",
    ],
    motionLanguage: [
      "forms dissolving outward",
      "lines that taper into nothing",
    ],
    negativeSpaceStrategy: [
      "let unfinished geometry dissolve into garment tone",
      "reserve fade zones at top and bottom thirds",
    ],
  },
  MEMORY: {
    visualSymbols: [
      "blurred edges",
      "fragmented layers",
      "repeated elements",
      "ghosted duplicates",
    ],
    compositionRules: [
      "layer repeated motifs with offset",
      "allow soft edge bleed between fragments",
      "build depth through stacked echoes",
    ],
    spacingRules: [
      "offset repeated forms by 6–10 mm",
      "maintain legibility through tonal separation",
    ],
    typographyRules: [
      "ghosted secondary type layer optional",
      "no photo-strip or archival collage framing",
    ],
    motionLanguage: [
      "echoed forms suggesting prior presence",
      "slight vertical drift between layers",
    ],
    negativeSpaceStrategy: [
      "quiet field around fragmented layers",
      "blur dissolves into negative space rather than clutter",
    ],
  },
  ACCEPTANCE: {
    visualSymbols: [
      "balanced forms",
      "symmetry anchors",
      "open composition",
      "settled geometry",
    ],
    compositionRules: [
      "open composition with calm hierarchy",
      "symmetry may anchor the center",
      "resolved but restrained geometry",
    ],
    spacingRules: [
      "even margins on all sides",
      "balanced spacing rhythm",
    ],
    typographyRules: [
      "one centered or aligned block with calm tracking",
      "no distressed urgency",
    ],
    motionLanguage: [
      "stillness after movement",
      "settled horizontal balance",
    ],
    negativeSpaceStrategy: [
      "open field supporting quiet resolution",
      "symmetry supported by generous outer air",
    ],
  },
  LOSS: {
    visualSymbols: [
      "missing sections",
      "cut shapes",
      "asymmetry",
      "absent center",
    ],
    compositionRules: [
      "remove a section of the form intentionally",
      "use asymmetry to signal absence",
      "never close the shape fully",
    ],
    spacingRules: [
      "bias weight to one side",
      "leave void where content was expected",
    ],
    typographyRules: [
      "absent or interrupted type only",
      "no symmetrical wordmark blocks",
    ],
    motionLanguage: [
      "broken continuity",
      "forms interrupted mid-path",
    ],
    negativeSpaceStrategy: [
      "the missing area is the focal subject",
      "asymmetric void replaces expected symmetry",
    ],
  },
};

const DOMINANT_STYLE_PATTERNS =
  /\b(japanese editorial|city pop|vogue|kapital|kanji|photo strip|visvim|harajuku)\b/i;

const CLOSE_COMPOSITION_PATTERNS =
  /\b(close|tight|overlap|interlock|clustered|stacked|centered pair|photo strip|kanji)\b|(?<!almost-)touching\b/i;

const RESOLVED_GRAPHIC_PATTERNS =
  /\b(fully resolved|complete circle|closed form|sealed|finished geometry|full frame|resolved emblem)\b/i;

const STALE_VISUAL_PATTERNS =
  /\b(japanese editorial|city pop|vogue|kapital|kanji|photo strip|harajuku|visvim)\b/gi;

export interface EmotionalVisualMatchResult {
  valid: boolean;
  issues: string[];
  repairedDesign?: DesignConcept;
}

export function isEmotionalVisualStrictMode(): boolean {
  return process.env.RESEARCH_EMOTIONAL_VISUAL_STRICT === "1";
}

function stripStaleVisualCopy(text: string): string {
  return text
    .replace(STALE_VISUAL_PATTERNS, "muted tonal styling")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toFullVisualLanguage(
  partial: DesignConcept["visualLanguage"],
  keyword: string,
): EmotionalVisualLanguage {
  return {
    emotionalKeyword: partial?.emotionalKeyword ?? keyword,
    visualSymbols: partial?.visualSymbols ?? [],
    compositionRules: partial?.compositionRules ?? [],
    spacingRules: partial?.spacingRules ?? [],
    typographyRules: partial?.typographyRules ?? [],
    motionLanguage: partial?.motionLanguage ?? [],
    negativeSpaceStrategy: partial?.negativeSpaceStrategy ?? [],
  };
}

function detectEmotionalVisualIssues(design: DesignConcept): string[] {
  const language = design.visualLanguage;
  if (!language) return ["missing visualLanguage"];

  const keyword =
    language.emotionalKeyword ??
    design.emotionalKeyword ??
    design.emotion;

  const category = dominantEmotionCategory(
    toFullVisualLanguage(language, keyword),
  );

  const compositionCorpus = [
    design.exactComposition,
    design.layoutDescription,
    design.visualConcept,
    design.placementDimensions,
    design.visualReferences,
    design.garmentInspiration,
    design.styleDirection,
    language.compositionRules?.join(" ") ?? "",
  ].join(" ");

  const graphicCorpus = [
    design.visualConcept,
    design.symbolism,
    design.graphicElements.join(" "),
    design.designDescription,
    language.visualSymbols?.join(" ") ?? "",
  ].join(" ");

  const issues: string[] = [];

  if (DOMINANT_STYLE_PATTERNS.test(compositionCorpus + graphicCorpus)) {
    issues.push("dominant editorial style reference conflicts with emotional visual language");
  }

  if (
    category === "DISTANCE" &&
    CLOSE_COMPOSITION_PATTERNS.test(compositionCorpus)
  ) {
    issues.push("distance emotion conflicts with close/tight composition");
  }

  if (category === "LOSS" && design.balance === "Symmetrical") {
    issues.push("loss emotion conflicts with symmetrical balance");
  }

  if (category === "LONGING" && RESOLVED_GRAPHIC_PATTERNS.test(graphicCorpus)) {
    issues.push("longing emotion conflicts with fully resolved graphic");
  }

  return issues;
}

function buildRepairLanguage(
  category: EmotionalVisualFamily | "MIXED",
  themeEmotion: ThemeEmotionalAnalysis,
  keyword: string,
): EmotionalVisualLanguage {
  const base = buildEmotionalVisualLanguage({
    analysis: themeEmotion,
    emotionalKeyword: keyword,
  });

  switch (category) {
    case "DISTANCE":
      return mergeFamilies(["DISTANCE"], keyword);
    case "LOSS":
      return mergeFamilies(["LOSS"], keyword);
    case "MEMORY":
      return mergeFamilies(["MEMORY"], keyword);
    case "LONGING":
      return mergeFamilies(["LONGING"], keyword);
    default:
      return base;
  }
}

function buildColorBreakdownFromLanguage(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
): DesignConcept["colorBreakdown"] {
  return [
    { color: design.color, usage: "garment base 62%" },
    { color: "Soft Black Ink", usage: "primary emotional mark 24%" },
    { color: "Stone Grey", usage: "secondary tonal layer 14%" },
    {
      color: "Muted Negative Space",
      usage: language.compositionRules.some((rule) => /40%|empty/i.test(rule))
        ? "empty center field 40%+"
        : "editorial breathing room",
    },
  ];
}

function buildMaterialEffectsFromLanguage(language: EmotionalVisualLanguage): string {
  if (/blur|fragment|fade|ghost/i.test(language.visualSymbols.join(" "))) {
    return "Soft matte plastisol with blurred edge fade and muted tonal restraint";
  }
  return "Soft hand feel, matte plastisol, premium washed garment texture with calm luxury restraint";
}

function applyVisualLanguageToDesign(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
  analysis: ThemeEmotionalAnalysis,
): DesignConcept {
  const primaryMotif = primaryMotifFromLanguage(language);
  const secondaryMotif = secondaryMotifFromLanguage(language);
  const category = dominantEmotionCategory(language);
  const approach = preferredCreativeApproach(language);

  const enriched: DesignConcept = {
    ...design,
    creativeApproach: approach,
    visualLanguage: {
      emotionalKeyword: language.emotionalKeyword,
      visualSymbols: language.visualSymbols,
      compositionRules: language.compositionRules,
      spacingRules: language.spacingRules,
      typographyRules: language.typographyRules,
      motionLanguage: language.motionLanguage,
      negativeSpaceStrategy: language.negativeSpaceStrategy,
    },
    visualConcept: stripStaleVisualCopy(
      buildVisualConceptFromLanguage(design, language),
    ),
    designDescription: stripStaleVisualCopy(
      `Narrative ${design.collectionRole.toLowerCase()} for ${design.title}: ${analysis.emotionalPain} expressed through ${primaryMotif}, held in ${analysis.emotionalTension}, resolving toward ${analysis.emotionalResolution}.`,
    ),
    graphicElements: buildGraphicElementsFromLanguage(language),
    exactComposition: stripStaleVisualCopy(
      buildExactCompositionFromLanguage(design, language),
    ),
    layoutDescription: stripStaleVisualCopy(
      buildLayoutDescriptionFromLanguage(design, language),
    ),
    visualHierarchy: `1) ${primaryMotif}  2) ${secondaryMotif}  3) ${language.negativeSpaceStrategy[0] ?? "negative space field"}`,
    colorBreakdown: buildColorBreakdownFromLanguage(design, language),
    materialEffects: buildMaterialEffectsFromLanguage(language),
    negativeSpaceUsage: buildNegativeSpaceFromLanguage(language),
    designInstructions: buildDesignInstructionsFromLanguage(design, language).map(
      stripStaleVisualCopy,
    ),
    mockupDescription: stripStaleVisualCopy(
      `${design.title} on ${design.product} in ${design.color} — ${primaryMotif} with ${language.negativeSpaceStrategy[0] ?? "generous negative space"}, editorial studio light, emotional visual translation`,
    ),
    geometry: stripStaleVisualCopy(
      `${primaryMotif} on vertical editorial axis with ${secondaryMotif}`,
    ),
    dimensions: design.dimensions?.includes("cm")
      ? design.dimensions
      : design.printSize || "28 cm editorial graphic zone",
    coordinates: design.coordinates || design.placementDimensions,
    imagePromptCore: stripStaleVisualCopy(
      buildImagePromptCoreFromLanguage(design, language),
    ),
    spacing: language.spacingRules[1] ?? language.spacingRules[0] ?? design.spacing,
    typography: language.typographyRules.join("; "),
    symbolism: stripStaleVisualCopy(
      `${language.emotionalKeyword} — ${primaryMotif} with ${secondaryMotif}; ${analysis.emotionalPain} made visible through ${analysis.emotionalConflict}`,
    ),
    placementDimensions: stripStaleVisualCopy(design.placementDimensions),
    printArea: design.printArea,
    balance: category === "LOSS" ? "Asymmetrical" : design.balance,
    elementCount: `${buildGraphicElementsFromLanguage(language).length} emotional visual layers`,
    garmentInspiration: "Premium oversized fleece construction — styling influence only",
    brandInspiration: "Milaene calm luxury restraint — styling influence only",
    visualReferences: "Emotional visual translation, muted tonal styling influence only",
    styleDirection: stripStaleVisualCopy(
      `${language.emotionalKeyword} visual narrative — calm luxury editorial restraint`,
    ),
  };

  return demoteDominantStyleReferences(enriched);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeFamilies(
  families: EmotionalVisualFamily[],
  emotionalKeyword: string,
): EmotionalVisualLanguage {
  const merged: EmotionalVisualLanguage = {
    emotionalKeyword,
    visualSymbols: [],
    compositionRules: [],
    spacingRules: [],
    typographyRules: [],
    motionLanguage: [],
    negativeSpaceStrategy: [],
  };

  for (const family of families) {
    const source = VISUAL_FAMILY_LIBRARY[family];
    merged.visualSymbols.push(...source.visualSymbols);
    merged.compositionRules.push(...source.compositionRules);
    merged.spacingRules.push(...source.spacingRules);
    merged.typographyRules.push(...source.typographyRules);
    merged.motionLanguage.push(...source.motionLanguage);
    merged.negativeSpaceStrategy.push(...source.negativeSpaceStrategy);
  }

  merged.visualSymbols = uniqueStrings(merged.visualSymbols).slice(0, 6);
  merged.compositionRules = uniqueStrings(merged.compositionRules).slice(0, 5);
  merged.spacingRules = uniqueStrings(merged.spacingRules).slice(0, 4);
  merged.typographyRules = uniqueStrings(merged.typographyRules).slice(0, 3);
  merged.motionLanguage = uniqueStrings(merged.motionLanguage).slice(0, 3);
  merged.negativeSpaceStrategy = uniqueStrings(merged.negativeSpaceStrategy).slice(0, 3);

  return merged;
}

function inferVisualFamilies(corpus: string): EmotionalVisualFamily[] {
  const lower = corpus.toLowerCase();
  const families = new Set<EmotionalVisualFamily>();

  if (
    /closeness without connection|distance|separated|loneliness|isolation|apart|void|empty room|searching without/i.test(
      lower,
    )
  ) {
    families.add("DISTANCE");
  }
  if (/connection|bond|together|touching|between us/i.test(lower)) {
    families.add("CONNECTION");
  }
  if (/longing|belonging|presence|fade|dissolv|unfinished|passing time/i.test(lower)) {
    families.add("LONGING");
  }
  if (/memory|moment|past|lost moment|never shared|fragment|echo/i.test(lower)) {
    families.add("MEMORY");
  }
  if (/acceptance|resolution|self-discovery|quiet becoming|settled/i.test(lower)) {
    families.add("ACCEPTANCE");
  }
  if (/loss|lost|missing|left|absence|cut|asymmetr|impermanence/i.test(lower)) {
    families.add("LOSS");
  }

  if (families.size === 0) {
    families.add("ACCEPTANCE");
  }

  if (families.has("DISTANCE") && families.has("CONNECTION")) {
    families.delete("CONNECTION");
  }

  return [...families];
}

export function resolveEmotionalVisualFamilies(
  analysis: ThemeEmotionalAnalysis,
  emotionalKeyword?: string,
): EmotionalVisualFamily[] {
  const corpus = [
    emotionalKeyword,
    analysis.emotionalTension,
    analysis.emotionalPain,
    analysis.emotionalConflict,
    analysis.emotionalLonging,
    analysis.emotionalMemory,
    analysis.emotionalResolution,
  ]
    .filter(Boolean)
    .join(" ");

  return inferVisualFamilies(corpus);
}

/** Build visual language from emotional architecture — not editorial style references. */
export function buildEmotionalVisualLanguage(input: {
  analysis?: ThemeEmotionalAnalysis;
  theme?: string;
  emotionalKeyword?: string;
}): EmotionalVisualLanguage {
  const analysis =
    input.analysis ??
    analyzeThemeEmotion(input.theme ?? input.emotionalKeyword ?? "milaene capsule");

  const keyword =
    input.emotionalKeyword ??
    analysis.emotionalTension ??
    analysis.emotionalPain;

  const families = resolveEmotionalVisualFamilies(analysis, keyword);
  return mergeFamilies(families, keyword);
}

function primaryMotifFromLanguage(language: EmotionalVisualLanguage): string {
  return language.visualSymbols[0] ?? "organic curve emblem";
}

function secondaryMotifFromLanguage(language: EmotionalVisualLanguage): string {
  return language.visualSymbols[1] ?? language.negativeSpaceStrategy[0] ?? "editorial negative space";
}

function dominantEmotionCategory(
  language: EmotionalVisualLanguage,
): EmotionalVisualFamily | "MIXED" {
  const corpus = language.emotionalKeyword.toLowerCase();
  if (/distance|separated|closeness without|loneliness|isolation|apart/.test(corpus)) {
    return "DISTANCE";
  }
  if (/loss|missing|left|absence|cut/.test(corpus)) return "LOSS";
  if (/longing|fade|unfinished|dissolv|presence/.test(corpus)) return "LONGING";
  if (/memory|fragment|echo|moment/.test(corpus)) return "MEMORY";
  if (/acceptance|resolution|balance|settled/.test(corpus)) return "ACCEPTANCE";
  if (/connection|bond|together|touch/.test(corpus)) return "CONNECTION";
  return "MIXED";
}

function preferredCreativeApproach(
  language: EmotionalVisualLanguage,
): DesignConcept["creativeApproach"] {
  const category = dominantEmotionCategory(language);
  switch (category) {
    case "DISTANCE":
    case "LOSS":
      return "Abstract Graphic";
    case "LONGING":
    case "MEMORY":
      return "Symbolic Illustration";
    case "CONNECTION":
      return "Minimal Back Print";
    case "ACCEPTANCE":
      return "Luxury Minimalism";
    default:
      return "Symbolic Illustration";
  }
}

function demoteDominantStyleReferences(design: DesignConcept): DesignConcept {
  const stylingNote =
    "Styling influence only — emotional visual language remains primary";

  return {
    ...design,
    garmentInspiration: DOMINANT_STYLE_PATTERNS.test(design.garmentInspiration)
      ? `Premium oversized fleece construction — ${stylingNote}`
      : design.garmentInspiration,
    brandInspiration: DOMINANT_STYLE_PATTERNS.test(design.brandInspiration)
      ? `Milaene calm luxury restraint — ${stylingNote}`
      : design.brandInspiration,
    visualReferences: DOMINANT_STYLE_PATTERNS.test(design.visualReferences)
      ? `Emotional visual translation, muted tonal styling — ${stylingNote}`
      : design.visualReferences,
    styleDirection: DOMINANT_STYLE_PATTERNS.test(design.styleDirection)
      ? `${design.emotionalKeyword ?? design.emotion} visual narrative — calm luxury editorial restraint`
      : design.styleDirection,
  };
}

function buildVisualConceptFromLanguage(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
): string {
  const symbols = language.visualSymbols.slice(0, 2).join(" and ");
  const composition = language.compositionRules[0] ?? "editorial restraint";
  return `${design.title} — ${language.emotionalKeyword} expressed through ${symbols}; ${composition}.`;
}

function buildExactCompositionFromLanguage(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
): string {
  const primary = primaryMotifFromLanguage(language);
  const spacing = language.spacingRules[0] ?? "large margins";
  const rule = language.compositionRules[0] ?? "open composition";
  return `${design.printSize || "28 cm"} ${primary} placed ${design.placementDimensions.toLowerCase()}. ${rule}. ${spacing}.`;
}

function buildNegativeSpaceFromLanguage(language: EmotionalVisualLanguage): string {
  return language.negativeSpaceStrategy.join(" — ");
}

function buildGraphicElementsFromLanguage(language: EmotionalVisualLanguage): string[] {
  return uniqueStrings([
    ...language.visualSymbols.slice(0, 3),
    language.motionLanguage[0] ?? "editorial spacing frame",
    language.negativeSpaceStrategy[0] ?? "negative space field",
  ]).slice(0, 5);
}

function buildLayoutDescriptionFromLanguage(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
): string {
  return [
    design.title,
    language.compositionRules.slice(0, 2).join("; "),
    language.motionLanguage[0] ?? "still editorial hierarchy",
  ].join(" — ");
}

function buildDesignInstructionsFromLanguage(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
): string[] {
  return [
    `Translate ${language.emotionalKeyword} through ${language.visualSymbols.slice(0, 2).join(" and ")} — not editorial style clichés`,
    language.compositionRules[0] ??
      "Maintain emotional composition discipline across the print zone",
    language.spacingRules[0] ??
      "Preserve large margins and Milaene negative space hierarchy",
    `Typography: ${language.typographyRules[0] ?? "restrained sans or absent type"}`,
  ];
}

function buildImagePromptCoreFromLanguage(
  design: DesignConcept,
  language: EmotionalVisualLanguage,
): string {
  return [
    design.title,
    language.visualSymbols.slice(0, 2).join(", "),
    language.emotionalKeyword,
    design.color,
    design.product,
    "calm luxury",
    "Milaene DNA",
    "emotional visual translation",
  ].join(", ");
}

/** Apply emotional visual translation to a design — wound and conflict override style references. */
export function applyEmotionalVisualLanguage(
  design: DesignConcept,
  collection: ResearchCollection,
): DesignConcept {
  const analysis = analyzeCollectionEmotion(collection);
  const language = buildEmotionalVisualLanguage({
    analysis,
    emotionalKeyword: design.emotionalKeyword ?? analysis.emotionalTension,
  });

  return applyVisualLanguageToDesign(design, language, analysis);
}

export function assertEmotionalVisualMatch(
  design: DesignConcept,
): EmotionalVisualMatchResult {
  const issues = detectEmotionalVisualIssues(design);
  return {
    valid: issues.length === 0,
    issues,
  };
}

/** Repair stale or mismatched emotional visuals into theme-aligned art direction. */
export function repairEmotionalVisualMismatch(
  design: DesignConcept,
  themeEmotion: ThemeEmotionalAnalysis,
  visualLanguage?: EmotionalVisualLanguage,
): DesignConcept {
  const keyword =
    visualLanguage?.emotionalKeyword ??
    design.emotionalKeyword ??
    themeEmotion.emotionalTension;

  const category = dominantEmotionCategory(
    visualLanguage ?? buildEmotionalVisualLanguage({ analysis: themeEmotion, emotionalKeyword: keyword }),
  );

  const language = buildRepairLanguage(category, themeEmotion, keyword);

  if (category === "DISTANCE") {
    language.visualSymbols = uniqueStrings([
      "two separated silhouettes",
      "empty center space",
      "almost-touching curves",
      "broken line",
      ...language.visualSymbols,
    ]).slice(0, 6);
    language.compositionRules = uniqueStrings([
      "avoid central overlap",
      "leave 40% empty area",
      "keep forms apart on a shared axis",
      ...language.compositionRules,
    ]).slice(0, 5);
    language.negativeSpaceStrategy = uniqueStrings([
      "empty center space as the emotional subject",
      "negative space must read louder than ink",
      "reserve at least 40% open field",
      ...language.negativeSpaceStrategy,
    ]).slice(0, 3);
  }

  if (category === "LOSS") {
    language.visualSymbols = uniqueStrings([
      "missing section",
      "cut shape",
      "asymmetry",
      "faded edge",
      ...language.visualSymbols,
    ]).slice(0, 6);
  }

  if (category === "MEMORY") {
    language.visualSymbols = uniqueStrings([
      "fragmented layers",
      "repeated marks",
      "blurred edge",
      "archive-style echo",
      ...language.visualSymbols,
    ]).slice(0, 6);
    language.typographyRules = uniqueStrings([
      "no photo-strip or vintage clutter framing",
      ...language.typographyRules,
    ]).slice(0, 3);
  }

  if (category === "LONGING") {
    language.visualSymbols = uniqueStrings([
      "unfinished lines",
      "disappearing form",
      "extended spacing",
      ...language.visualSymbols,
    ]).slice(0, 6);
  }

  const repaired = applyVisualLanguageToDesign(design, language, themeEmotion);
  return repaired;
}

/** Detect mismatch, repair when needed, and only throw in strict debug mode. */
export function ensureEmotionalVisualMatch(
  design: DesignConcept,
  collection: ResearchCollection,
  adjustments: string[] = [],
): DesignConcept {
  const initial = assertEmotionalVisualMatch(design);
  if (initial.valid) return design;

  const themeEmotion = analyzeCollectionEmotion(collection);
  const language = toFullVisualLanguage(
    design.visualLanguage,
    design.emotionalKeyword ?? themeEmotion.emotionalTension,
  );

  let repaired = repairEmotionalVisualMismatch(
    design,
    themeEmotion,
    language,
  );

  adjustments.push(
    `emotional visual mismatch repaired for ${repaired.title}`,
  );

  const recheck = assertEmotionalVisualMatch(repaired);
  if (!recheck.valid) {
    repaired = repairEmotionalVisualMismatch(
      repaired,
      themeEmotion,
      buildEmotionalVisualLanguage({
        analysis: themeEmotion,
        emotionalKeyword: repaired.emotionalKeyword ?? themeEmotion.emotionalTension,
      }),
    );
    adjustments.push(
      `emotional visual mismatch second-pass repair for ${repaired.title}`,
    );
  }

  const finalCheck = assertEmotionalVisualMatch(repaired);
  if (!finalCheck.valid && isEmotionalVisualStrictMode()) {
    throw new Error("EMOTIONAL_VISUAL_MISMATCH");
  }

  return repaired;
}

export function scoreEmotionalDnaAlignment(design: DesignConcept): number {
  const language = design.visualLanguage;
  if (!language) return roundPercent(design.dnaScore);
  const corpus = [
    design.whyFitsMilaene.join(" "),
    design.dnaMatches.join(" "),
    design.styleDirection,
  ].join(" ");
  let score = design.dnaScore;
  if (/negative space|muted|editorial|organic|restraint/i.test(corpus)) score += 4;
  if (DOMINANT_STYLE_PATTERNS.test(corpus)) score -= 8;
  if ((language.visualSymbols?.length ?? 0) >= 2) score += 3;
  return roundPercent(Math.max(0, Math.min(100, score)));
}

export function logFinalEmotionalVisual(input: {
  emotion: string;
  visualLanguage: DesignConcept["visualLanguage"];
  symbolism: string;
  composition: string;
  negativeSpace: string;
  dnaAlignment: number;
}): void {
  console.log("FINAL EMOTIONAL VISUAL:");
  console.log(`emotion: ${input.emotion}`);
  console.log(
    `visualLanguage: ${JSON.stringify(input.visualLanguage ?? {}, null, 0)}`,
  );
  console.log(`symbolism: ${input.symbolism}`);
  console.log(`composition: ${input.composition}`);
  console.log(`negativeSpace: ${input.negativeSpace}`);
  console.log(`dnaAlignment: ${input.dnaAlignment}`);
}
