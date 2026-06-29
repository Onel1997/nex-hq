import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { composeFromBrief, enrichArtworkSpec } from "@/lib/design/design-library/composition/engine";
import {
  auditHeroVisualComplexity,
  isHeroRole,
  scoreArtworkSpec,
  validateArtworkCandidate,
} from "@/lib/design/design-library/quality/score";
import { ALL_TEMPLATE_IDS, getTemplate } from "@/lib/design/design-library/templates/registry";
import { selectTemplateSeed } from "@/lib/design/design-library/templates/select";
import type {
  CompositionOverrides,
  DesignStyleId,
  LayoutId,
  LibraryArtworkSpec,
  TemplateId,
} from "@/lib/design/design-library/types";

const MIN_CANDIDATES = 8;

const HERO_LOGO_TEMPLATES = new Set(["luxury-wordmark", "minimal-emblem", "micro-graphic"]);

const FALLBACK_OVERRIDES: CompositionOverrides[] = [
  { templateId: "editorial-poster", forceRich: true },
  { templateId: "faith-collection", forceRich: true },
  { templateId: "oversized-graphic", forceRich: true },
  { templateId: "monochrome-symbol", styleId: "architectural", layoutId: "gallery-layout", forceRich: true },
  { templateId: "luxury-wordmark", styleId: "minimal-luxury", layoutId: "symbol-above-type", forceRich: true },
];

/** Hero Piece fallback chain when visual audit fails. */
const HERO_FALLBACK_OVERRIDES: CompositionOverrides[] = [
  { templateId: "editorial-poster", layoutId: "oversized-front", forceRich: true },
  { templateId: "oversized-graphic", layoutId: "oversized-front", forceRich: true },
  { templateId: "faith-collection", layoutId: "symbol-above-type", forceRich: true },
  { templateId: "monochrome-symbol", styleId: "architectural", layoutId: "gallery-layout", forceRich: true },
];

function uniqueKey(spec: LibraryArtworkSpec): string {
  return `${spec.template.id}|${spec.style.id}|${spec.layout.id}`;
}

export function generateArtworkCandidates(brief: DesignStudioBrief): LibraryArtworkSpec[] {
  const seed = selectTemplateSeed(brief);
  const candidates: LibraryArtworkSpec[] = [];
  const seen = new Set<string>();

  const push = (spec: LibraryArtworkSpec) => {
    const key = uniqueKey(spec);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(spec);
  };

  push(composeFromBrief(brief));

  const rotated = [...ALL_TEMPLATE_IDS].sort((a, b) => {
    const ha = (seed + a.length) % 100;
    const hb = (seed + b.length) % 100;
    return ha - hb;
  });

  for (let i = 0; i < rotated.length; i++) {
    const templateId = rotated[i]!;
    const template = getTemplate(templateId);
    push(
      composeFromBrief(brief, {
        templateId,
        styleId: template.styleId,
        layoutId: template.layoutId,
        variantIndex: i + 1,
      }),
    );
  }

  const styleVariants: Array<{ styleId: DesignStyleId; layoutId: LayoutId; templateId: TemplateId }> = [
    { styleId: "editorial-fashion", layoutId: "oversized-front", templateId: "editorial-poster" },
    { styleId: "architectural", layoutId: "gallery-layout", templateId: "monochrome-symbol" },
    { styleId: "faith", layoutId: "symbol-above-type", templateId: "faith-collection" },
    { styleId: "vintage-washed", layoutId: "gallery-layout", templateId: "gallery-composition" },
  ];

  styleVariants.forEach((variant, index) => {
    push(
      composeFromBrief(brief, {
        ...variant,
        variantIndex: rotated.length + index + 1,
      }),
    );
  });

  while (candidates.length < MIN_CANDIDATES) {
    const templateId = rotated[candidates.length % rotated.length]!;
    const template = getTemplate(templateId);
    push(
      composeFromBrief(brief, {
        templateId,
        styleId: template.styleId,
        layoutId: template.layoutId,
        variantIndex: candidates.length + 100,
        forceRich: true,
      }),
    );
  }

  return candidates;
}

function scoreCandidate(spec: LibraryArtworkSpec, brief: DesignStudioBrief) {
  const score = scoreArtworkSpec(spec);
  const validation = validateArtworkCandidate(spec, score, brief);
  console.log(`[DESIGN LIBRARY] Candidate scored: ${spec.template.name} ${score.overall}`);
  if (!validation.valid && validation.reason) {
    console.log(`[DESIGN LIBRARY] Rejected candidate: ${validation.reason}`);
  }
  return { spec, score, validation };
}

function sortCandidates(
  a: ReturnType<typeof scoreCandidate>,
  b: ReturnType<typeof scoreCandidate>,
  hero: boolean,
) {
  if (hero) {
    const richnessDelta = b.score.compositionRichness - a.score.compositionRichness;
    if (richnessDelta !== 0) return richnessDelta;
    const apparelDelta = b.score.apparelReadiness - a.score.apparelReadiness;
    if (apparelDelta !== 0) return apparelDelta;
  }
  if (b.score.overall !== a.score.overall) return b.score.overall - a.score.overall;
  return b.score.apparelReadiness - a.score.apparelReadiness;
}

function buildFallbackCandidates(
  brief: DesignStudioBrief,
  overrides: CompositionOverrides[],
  startIndex: number,
) {
  return overrides.map((overridesEntry, index) => {
    const spec = enrichArtworkSpec(
      composeFromBrief(brief, { ...overridesEntry, variantIndex: startIndex + index }),
    );
    return scoreCandidate(spec, brief);
  });
}

export function selectBestArtwork(brief: DesignStudioBrief): LibraryArtworkSpec {
  const hero = isHeroRole(brief.role);
  const candidates = generateArtworkCandidates(brief);
  const scored = candidates.map((spec) => scoreCandidate(spec, brief));

  const valid = scored.filter((c) => c.validation.valid);
  const heroSafe = hero
    ? valid.filter((c) => !HERO_LOGO_TEMPLATES.has(c.spec.template.id))
    : valid;
  const pool = heroSafe.length > 0 ? heroSafe : valid.length > 0 ? valid : scored;

  pool.sort((a, b) => sortCandidates(a, b, hero));

  let selected = pool[0];

  const needsHeroFallback =
    hero &&
    selected &&
    (!selected.validation.valid || !auditHeroVisualComplexity(selected.spec).passed);

  if (!selected || !selected.validation.valid || needsHeroFallback) {
    const fallbackOverrides = hero ? HERO_FALLBACK_OVERRIDES : FALLBACK_OVERRIDES;
    console.log(
      hero
        ? "[DESIGN LIBRARY] Hero visual audit failed — forcing hero fallback chain"
        : "[DESIGN LIBRARY] All candidates failed quality gate — forcing rich fallback",
    );

    const fallbackScored = buildFallbackCandidates(brief, fallbackOverrides, 200);
    fallbackScored.sort((a, b) => sortCandidates(a, b, hero));

    const passingFallback = fallbackScored.find((c) => c.validation.valid);
    selected = passingFallback ?? fallbackScored[0] ?? selected;
  }

  if (!selected) {
    const fallbackSpec = enrichArtworkSpec(
      composeFromBrief(brief, { templateId: "editorial-poster", layoutId: "oversized-front", forceRich: true }),
    );
    selected = {
      spec: fallbackSpec,
      score: scoreArtworkSpec(fallbackSpec),
      validation: { valid: true },
    };
  }

  let finalSpec = selected.spec;
  if (hero) {
    finalSpec = enrichArtworkSpec(finalSpec);
    const audit = auditHeroVisualComplexity(finalSpec);
    if (!audit.passed || HERO_LOGO_TEMPLATES.has(finalSpec.template.id)) {
      const richFallback = buildFallbackCandidates(brief, HERO_FALLBACK_OVERRIDES, 400).find(
        (c) => c.validation.valid && !HERO_LOGO_TEMPLATES.has(c.spec.template.id),
      );
      if (richFallback) {
        finalSpec = richFallback.spec;
      } else {
        finalSpec = enrichArtworkSpec(
          composeFromBrief(brief, {
            templateId: "editorial-poster",
            layoutId: "oversized-front",
            forceRich: true,
            variantIndex: 999,
          }),
        );
      }
    }
  }

  const finalScore = scoreArtworkSpec(finalSpec);
  console.log(
    `[DESIGN LIBRARY] Selected candidate: ${finalSpec.template.name} ${finalScore.overall}`,
  );

  return finalSpec;
}
