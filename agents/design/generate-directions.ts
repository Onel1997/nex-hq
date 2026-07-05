import "server-only";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignDirection,
  DesignDirectionScores,
  TeamInsight,
} from "@/lib/design/design-directions";
import { getOpenAIClient } from "@/lib/openai/client";
import { loadResearchDirectionContext } from "./load-research-context";
import {
  DesignDirectionsParseError,
  parseGeneratedDirections,
  type GeneratedDirection,
} from "./parse-directions";

/** Minimal concept fields needed for direction generation context. */
export interface DirectionConceptContext {
  title: string;
  collection: string;
  product: string;
  color: string;
  printArea: string;
  designStory: string;
  creativeDirection: {
    summary: string;
    mood: string;
    emotion: string;
    collectionRole: string;
    visualIntent: string;
    fashionSystem: string;
  };
  fashionLanguage: {
    principles: string[];
  };
  typographyLanguage: {
    direction: string;
    hierarchy: string;
  };
  commercialIntention: {
    buyerHook: string;
  };
}

const BANNED_DIRECTION_TITLES = [
  "luxury minimal",
  "editorial typography",
  "graphic narrative",
  "vintage heritage",
  "fashion art",
];

const TEAM_ROLES = [
  { role: "Research Director", focus: "Trend Intelligence", key: "researchDirector" as const },
  { role: "Creative Director", focus: "Visual Story", key: "creativeDirector" as const },
  { role: "Typography Director", focus: "Typography hierarchy", key: "typographyDirector" as const },
  { role: "Fashion Designer", focus: "Garment composition", key: "fashionDesigner" as const },
  { role: "Commercial Director", focus: "Conversion analysis", key: "commercialDirector" as const },
  { role: "Print Engineer", focus: "Production feasibility", key: "printEngineer" as const },
];

export interface GenerateDesignDirectionsInput {
  workspaceId: string;
  reportId: string;
  brief: DesignStudioBrief;
  concept: DirectionConceptContext;
  /** Avoid repeating these direction names from prior runs. */
  avoidTitles?: string[];
  /** When regenerating, produce exactly one replacement direction. */
  count?: number;
  generationNonce?: string;
}

export interface GenerateDesignDirectionsResult {
  directions: DesignDirection[];
  researchContextUsed: boolean;
}

function buildConceptContext(concept: DirectionConceptContext, brief: DesignStudioBrief): string {
  return [
    "## Current Design Concept (AI Designer Blueprint)",
    `Title: ${concept.title}`,
    `Collection: ${concept.collection}`,
    `Product: ${concept.product} · ${concept.color} · ${concept.printArea}`,
    `Creative Direction: ${concept.creativeDirection.summary}`,
    `Mood: ${concept.creativeDirection.mood} · Emotion: ${concept.creativeDirection.emotion}`,
    `Visual Intent: ${concept.creativeDirection.visualIntent}`,
    `Fashion System: ${concept.creativeDirection.fashionSystem}`,
    `Collection Role: ${concept.creativeDirection.collectionRole}`,
    `Design Story: ${concept.designStory}`,
    `Fashion Language: ${concept.fashionLanguage.principles.join(", ")}`,
    `Typography: ${concept.typographyLanguage.direction} — ${concept.typographyLanguage.hierarchy}`,
    `Commercial Hook: ${concept.commercialIntention.buyerHook}`,
    `Brief Visual: ${brief.visualConcept}`,
    `Brief DNA Score: ${brief.dnaScore ?? "—"}%`,
    `Brief Commercial Score: ${brief.commercialScore ?? "—"}%`,
  ].join("\n");
}

function buildSystemPrompt(workspaceName: string): string {
  return `You are the Creative Direction AI for Milaene — a premium streetwear brand in workspace "${workspaceName}".

Your task: generate completely NEW, unique Design Directions for a collection. Each run must feel fresh — never reuse template names or concepts.

## CRITICAL RULES
- Generate 3 to 5 directions (exact count specified in user message)
- Every direction must occupy a DIFFERENT creative territory — mix inspirations, moods, and visual systems
- NO hardcoded template names. BANNED titles include: Luxury Minimal, Editorial Typography, Graphic Narrative, Vintage Heritage, Fashion Art
- Names must be original, evocative, and specific to THIS research context (e.g. "Neo Heritage", "Silent Utility", "Soft Brutalism" — but never copy these exactly)
- Base every direction on the Research HQ intelligence provided — trends, competitors, audience, brand DNA, collection theme
- Designs must be POD-realistic (MarketPrint Print On Demand)
- Write in English for direction content

## DIVERSITY REQUIREMENT
Spread directions across different creative territories:
- typographic-led vs symbol-led vs abstract graphic vs material-led vs cultural reference vs architectural minimal vs street editorial
- Do NOT generate five nearly identical minimal concepts
- Each direction should feel like a different creative director pitched it

## COMMERCIAL SCORING (REQUIRED — NO FAKE VALUES)
After crafting each direction, honestly estimate scores (0–100) based on the research context:
- brandFit: alignment with Milaene brand DNA (calm luxury, emotional minimalism, quiet confidence)
- commercial: overall commercial potential for this audience and market
- originality: how distinct and fresh vs competitors
- manufacturingDifficulty: production complexity (higher = harder to produce)
- conversionPotential: likelihood to drive purchase on scroll
- printComplexity: graphic/print production complexity (higher = more complex)
- luxury: premium perception signal
- virality: social share / scroll-stop potential
- collectionFit: cohesion with the collection theme

Score honestly — not every direction should score 90+. Differentiate clearly.

## OUTPUT FORMAT
Respond ONLY with valid JSON:
{
  "directions": [
    {
      "title": "Unique Direction Name",
      "philosophy": "Creative philosophy — 1-2 sentences",
      "designStory": "Design story — 3-5 sentences, narrative and evocative",
      "fashionLanguage": "Fashion language — silhouettes, styling, garment attitude",
      "silhouetteIdeas": "Specific silhouette ideas for this direction",
      "typography": "Typography direction",
      "graphicStyle": "Graphic style approach",
      "colorSystem": "Color palette description with specific tones",
      "materials": "Materials and fabric language",
      "printStyle": "Print approach (DTG, screen, embroidery, etc.)",
      "commercialReasoning": "Why this direction wins commercially — 2-3 sentences",
      "targetAudience": "Specific target customer profile",
      "mood": "Mood in 2-4 words",
      "composition": "Composition and layout approach on garment",
      "trendAlignment": "Which trend or cultural signal this taps",
      "colorHexes": ["#hex1", "#hex2", "#hex3"],
      "scores": {
        "brandFit": 0-100,
        "commercial": 0-100,
        "originality": 0-100,
        "manufacturingDifficulty": 0-100,
        "conversionPotential": 0-100,
        "printComplexity": 0-100,
        "luxury": 0-100,
        "virality": 0-100,
        "collectionFit": 0-100
      },
      "teamInsights": {
        "researchDirector": "Trend intelligence insight",
        "creativeDirector": "Visual story insight",
        "typographyDirector": "Typography insight",
        "fashionDesigner": "Garment composition insight",
        "commercialDirector": "Commercial/conversion insight",
        "printEngineer": "Production feasibility insight"
      }
    }
  ]
}`;
}

function buildUserPrompt(
  researchFormatted: string,
  conceptContext: string,
  count: number,
  avoidTitles: string[],
  nonce: string,
): string {
  const avoidList =
    avoidTitles.length > 0
      ? `\n\nAVOID these already-used direction names:\n${avoidTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  return `${researchFormatted}

${conceptContext}

---
Generate exactly ${count} completely unique Design Directions grounded in the Research HQ intelligence above.
Generation nonce: ${nonce} — use this to ensure fresh, non-repetitive concepts.
${avoidList}

Remember: diverse creative territories, original names, honest commercial scores.`;
}

function mapScores(generated: GeneratedDirection["scores"], brief: DesignStudioBrief): DesignDirectionScores {
  return {
    brandFit: Math.round(generated.brandFit),
    commercial: Math.round(generated.commercial),
    originality: Math.round(generated.originality),
    printComplexity: Math.round(generated.printComplexity ?? 50),
    conversionPotential: Math.round(generated.conversionPotential),
    luxury: Math.round(generated.luxury ?? generated.brandFit),
    manufacturingDifficulty: Math.round(generated.manufacturingDifficulty),
    virality: Math.round(generated.virality ?? generated.conversionPotential),
    collectionFit: Math.round(generated.collectionFit ?? brief.commercialScore ?? 70),
  };
}

function buildTeamInsights(
  generated: GeneratedDirection,
  scores: DesignDirectionScores,
): TeamInsight[] {
  const insights = generated.teamInsights ?? {};

  const defaults: Record<string, string> = {
    researchDirector: `${generated.trendAlignment} — aligned with current market signals for ${generated.targetAudience}.`,
    creativeDirector: generated.designStory.split(".")[0] ?? generated.philosophy,
    typographyDirector: `${generated.typography} — hierarchy supports ${generated.mood} mood.`,
    fashionDesigner: `${generated.silhouetteIdeas}. Composition: ${generated.composition}.`,
    commercialDirector: generated.commercialReasoning,
    printEngineer: `${generated.printStyle} on ${generated.materials} — complexity ${scores.printComplexity}%, manufacturing ${scores.manufacturingDifficulty}%.`,
  };

  return TEAM_ROLES.map(({ role, focus, key }) => ({
    role,
    focus,
    insight: insights[key] ?? defaults[key] ?? `${focus} analysis complete.`,
  }));
}

function buildThumbnailColors(
  generated: GeneratedDirection,
  brief: DesignStudioBrief,
  index: number,
): string[] {
  if (generated.colorHexes?.length) {
    return generated.colorHexes.slice(0, 3);
  }

  const palette = brief.colorPalette
    .map((entry) => (typeof entry === "object" ? entry.hex : undefined))
    .filter(Boolean) as string[];

  if (palette.length >= 3) {
    const rotated = [...palette.slice(index % palette.length), ...palette.slice(0, index % palette.length)];
    return rotated.slice(0, 3);
  }

  return ["#1a1f2e", "#141820", "#d9b46b"];
}

function mapToDesignDirection(
  generated: GeneratedDirection,
  index: number,
  brief: DesignStudioBrief,
): DesignDirection {
  const scores = mapScores(generated.scores, brief);

  return {
    id: crypto.randomUUID(),
    title: generated.title,
    philosophy: generated.philosophy,
    designStory: generated.designStory,
    fashionLanguage: `${generated.fashionLanguage} · ${generated.silhouetteIdeas} · ${generated.materials}`,
    mood: generated.mood,
    typography: generated.typography,
    printStyle: `${generated.printStyle} · ${generated.graphicStyle}`,
    colorSystem: generated.colorSystem,
    composition: generated.composition,
    targetAudience: generated.targetAudience,
    trendAlignment: generated.trendAlignment,
    thumbnailColors: buildThumbnailColors(generated, brief, index),
    variantIndex: index,
    scores,
    teamInsights: buildTeamInsights(generated, scores),
    archived: false,
    selected: false,
    compareSelected: false,
  };
}

function isBannedTitle(title: string): boolean {
  const normalized = title.toLowerCase().trim();
  return BANNED_DIRECTION_TITLES.some(
    (banned) => normalized === banned || normalized.startsWith(`${banned} `),
  );
}

async function callDirectionGeneration(
  systemPrompt: string,
  userPrompt: string,
  retries = 2,
): Promise<GeneratedDirection[]> {
  const client = getOpenAIClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        temperature: attempt === 0 ? 0.92 : 0.97,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              attempt > 0
                ? `${userPrompt}\n\nPrevious attempt had invalid output. Return only valid JSON matching the schema.`
                : userPrompt,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const payload = parseGeneratedDirections(raw);

      const filtered = payload.directions.filter((d) => !isBannedTitle(d.title));
      if (filtered.length < 3) {
        throw new DesignDirectionsParseError(
          "Too many template-like direction names — retrying for originality",
        );
      }

      return filtered;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) break;
    }
  }

  throw lastError ?? new DesignDirectionsParseError("Direction generation failed");
}

/** Generate AI-driven design directions from Research HQ intelligence. */
export async function generateDesignDirectionsFromResearch(
  input: GenerateDesignDirectionsInput,
  workspaceName: string,
): Promise<GenerateDesignDirectionsResult> {
  const loaded = await loadResearchDirectionContext(input.workspaceId, input.reportId);

  const researchFormatted =
    loaded?.formatted ??
    "## Research Context\nLimited research context available — derive directions from the design concept and brief.";

  const conceptContext = buildConceptContext(input.concept, input.brief);
  const count = input.count ?? 3 + Math.floor(Math.random() * 3);
  const avoidTitles = [
    ...BANNED_DIRECTION_TITLES,
    ...(input.avoidTitles ?? []).map((t) => t.toLowerCase()),
  ];
  const nonce = input.generationNonce ?? `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const systemPrompt = buildSystemPrompt(workspaceName);
  const userPrompt = buildUserPrompt(
    researchFormatted,
    conceptContext,
    count,
    avoidTitles,
    nonce,
  );

  const generated = await callDirectionGeneration(systemPrompt, userPrompt);

  const directions = generated
    .slice(0, count)
    .map((entry, index) => mapToDesignDirection(entry, index, input.brief))
    .sort((a, b) => b.scores.commercial - a.scores.commercial);

  return {
    directions,
    researchContextUsed: Boolean(loaded),
  };
}

/** Regenerate a single direction with a fresh AI concept. */
export async function regenerateDesignDirectionFromResearch(
  input: GenerateDesignDirectionsInput,
  workspaceName: string,
): Promise<DesignDirection> {
  const result = await generateDesignDirectionsFromResearch(
    { ...input, count: 1 },
    workspaceName,
  );

  const direction = result.directions[0];
  if (!direction) {
    throw new DesignDirectionsParseError("Failed to regenerate direction");
  }

  return direction;
}
