import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { composeFromBrief, enrichArtworkSpec } from "@/lib/design/design-library/composition/engine";
import {
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

const FALLBACK_OVERRIDES: CompositionOverrides[] = [
  { templateId: "editorial-poster", forceRich: true },
  { templateId: "faith-collection", forceRich: true },
  { templateId: "oversized-graphic", forceRich: true },
  { templateId: "monochrome-symbol", styleId: "architectural", layoutId: "gallery-layout", forceRich: true },
  { templateId: "luxury-wordmark", styleId: "minimal-luxury", layoutId: "symbol-above-type", forceRich: true },
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

export function selectBestArtwork(brief: DesignStudioBrief): LibraryArtworkSpec {
  const candidates = generateArtworkCandidates(brief);
  const scored = candidates.map((spec) => {
    const score = scoreArtworkSpec(spec);
    const validation = validateArtworkCandidate(spec, score, brief);
    console.log(
      `[DESIGN LIBRARY] Candidate scored: ${spec.template.name} ${score.overall}`,
    );
    if (!validation.valid && validation.reason) {
      console.log(`[DESIGN LIBRARY] Rejected candidate: ${validation.reason}`);
    }
    return { spec, score, validation };
  });

  const valid = scored.filter((c) => c.validation.valid);
  const pool = valid.length > 0 ? valid : scored;

  pool.sort((a, b) => {
    if (b.score.overall !== a.score.overall) return b.score.overall - a.score.overall;
    return b.score.apparelReadiness - a.score.apparelReadiness;
  });

  let selected = pool[0];

  if (!selected || !selected.validation.valid) {
    console.log("[DESIGN LIBRARY] All candidates failed quality gate — forcing rich fallback");
    const fallbackScored = FALLBACK_OVERRIDES.map((overrides, index) => {
      const spec = enrichArtworkSpec(composeFromBrief(brief, { ...overrides, variantIndex: 200 + index }));
      const score = scoreArtworkSpec(spec);
      const validation = validateArtworkCandidate(spec, score, brief);
      console.log(`[DESIGN LIBRARY] Candidate scored: ${spec.template.name} ${score.overall}`);
      if (!validation.valid && validation.reason) {
        console.log(`[DESIGN LIBRARY] Rejected candidate: ${validation.reason}`);
      }
      return { spec, score, validation };
    });

    fallbackScored.sort((a, b) => b.score.overall - a.score.overall);
    selected = fallbackScored[0] ?? selected;
  }

  if (!selected) {
    const fallbackSpec = enrichArtworkSpec(
      composeFromBrief(brief, { templateId: "editorial-poster", forceRich: true }),
    );
    selected = {
      spec: fallbackSpec,
      score: scoreArtworkSpec(fallbackSpec),
      validation: { valid: true },
    };
  }

  console.log(
    `[DESIGN LIBRARY] Selected candidate: ${selected.spec.template.name} ${selected.score.overall}`,
  );

  return selected.spec;
}
