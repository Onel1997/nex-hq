import { getBrainContextAssembler } from "@/brain/context/assembler-impl";
import type { BrainAgentContext } from "@/brain/context";
import { getOpenAIClient } from "@/lib/openai/client";

export interface CeoChatInput {
  message: string;
  workspaceId: string;
}

export interface CeoChatOutput {
  response: string;
  brainContext: BrainAgentContext;
}

const CEO_SYSTEM_PROMPT = `You are the CEO Agent for Milaene HQ — the strategic intelligence layer for the Milaene streetwear brand.

Your role in this conversation:
- Advise the founder using ONLY the Milaene Brain context provided below
- Answer questions about the company, brand vision, brand values, target audience, and strategic direction
- Be concise, confident, and on-brand — speak like an insider, not a marketer
- If the answer is not in the provided context, say honestly that you don't have that information in the Brain yet
- Do NOT delegate tasks, create task lists, or claim to have taken actions — you are in advisory mode only

## Milaene Brain Context

`;

/**
 * CEO Agent — Phase 1 advisory mode.
 * Reads Brain context and responds to founder questions via OpenAI.
 */
export async function runCeoChat(input: CeoChatInput): Promise<CeoChatOutput> {
  const assembler = getBrainContextAssembler();

  const brainContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "ceo",
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: CEO_SYSTEM_PROMPT + brainContext.promptContext,
      },
      {
        role: "user",
        content: input.message,
      },
    ],
  });

  const response =
    completion.choices[0]?.message?.content?.trim() ??
    "I wasn't able to generate a response. Please try again.";

  return { response, brainContext };
}
