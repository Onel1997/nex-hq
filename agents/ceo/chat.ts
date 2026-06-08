import { getBrainContextAssembler } from "@/brain/context/assembler-impl";
import type { BrainAgentContext } from "@/brain/context";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createTranslator } from "@/lib/i18n/translate";
import { getOpenAIClient } from "@/lib/openai/client";

export interface CeoChatInput {
  message: string;
  workspaceId: string;
  workspaceName: string;
  locale?: Locale;
}

export interface CeoChatOutput {
  response: string;
  brainContext: BrainAgentContext;
}

function buildCeoSystemPrompt(
  workspaceName: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const dict = getDictionary(locale);
  const t = createTranslator(dict as unknown as Record<string, unknown>);

  return (
    t("ceo.systemPrompt", {
      platformName: dict.platform.name,
      workspaceName,
      brainName: dict.platform.brainName,
    }) + "\n"
  );
}

/**
 * CEO Agent — Phase 1 advisory mode.
 * Reads workspace Brain context and responds to founder questions via OpenAI.
 */
export async function runCeoChat(input: CeoChatInput): Promise<CeoChatOutput> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const assembler = getBrainContextAssembler();

  const brainContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "ceo",
    locale,
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          buildCeoSystemPrompt(input.workspaceName, locale) +
          brainContext.promptContext,
      },
      {
        role: "user",
        content: input.message,
      },
    ],
  });

  const response =
    completion.choices[0]?.message?.content?.trim() ??
    dict.ceo.fallbackResponse;

  return { response, brainContext };
}
