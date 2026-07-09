import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { getOpenAIClient } from "@/lib/openai/client";
import {
  applyCreativeSuggestion,
  computeDesignHealth,
} from "@/lib/design/design-workspace-utils";
import type { DesignPromptOverrides } from "@/lib/design/design-mission-store";

export interface CreativeDirectorInput {
  message: string;
  brief: DesignStudioBrief;
  workspaceName: string;
}

export interface CreativeDirectorResult {
  response: string;
  briefPatch: Partial<DesignStudioBrief>;
  promptPatch?: Partial<DesignPromptOverrides>;
  health: ReturnType<typeof computeDesignHealth>;
}

export async function runCreativeDirectorChat(
  input: CreativeDirectorInput,
): Promise<CreativeDirectorResult> {
  const fallback = applyCreativeSuggestion(input.brief, input.message);
  const health = computeDesignHealth(fallback.brief);

  if (!process.env.OPENAI_API_KEY) {
    return {
      response: `${fallback.note} OpenAI is offline — applied local creative rules.`,
      briefPatch: diffBrief(input.brief, fallback.brief),
      health,
    };
  }

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Milaene's Creative Director AI inside a luxury fashion design lab for workspace "${input.workspaceName}".
Respond with JSON only:
{
  "response": "2-3 sentence creative director feedback",
  "briefPatch": { optional partial fields: visualConcept, designDescription, geometry, typography, materialEffects, negativeSpaceRules, productionMethod, designerInstructions },
  "promptPatch": { optional: svgPrompt, mockupPrompt, imagePrompt, designerPrompt }
}
Keep changes production-realistic. Honor calm luxury restraint.`,
        },
        {
          role: "user",
          content: `Current design "${input.brief.title}" (${input.brief.role} on ${input.brief.product}, ${input.brief.color}).
Visual: ${input.brief.visualConcept}
Director request: ${input.message}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      response?: string;
      briefPatch?: Partial<DesignStudioBrief>;
      promptPatch?: Partial<DesignPromptOverrides>;
    };

    const merged = { ...fallback.brief, ...(parsed.briefPatch ?? {}) };

    return {
      response: parsed.response ?? fallback.note,
      briefPatch: diffBrief(input.brief, merged),
      promptPatch: parsed.promptPatch,
      health: computeDesignHealth(merged),
    };
  } catch {
    return {
      response: fallback.note,
      briefPatch: diffBrief(input.brief, fallback.brief),
      health,
    };
  }
}

function diffBrief(
  before: DesignStudioBrief,
  after: DesignStudioBrief,
): Partial<DesignStudioBrief> {
  const patch: Partial<DesignStudioBrief> = {};
  const keys = Object.keys(after) as Array<keyof DesignStudioBrief>;
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      Object.assign(patch, { [key]: after[key] });
    }
  }
  return patch;
}
