import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { CeoParseError, parseCeoOutput } from "./parse-output";
import { CeoKnowledgeError, retrieveCeoKnowledge } from "./retrieve-context";
import { saveCeoToBrain } from "./save";
import type { CeoRunInput, CeoRunResult } from "./types";

function buildCeoSystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  return `Du bist der CEO-Agent von NexHQ — strategischer Berater für den Workspace "${workspaceName}".

## Deine Rolle
- Triff strategische Entscheidungen auf Basis des bereitgestellten Wissensspeicher-Kontexts
- Du darfst NIEMALS nur aus allgemeinem Modellwissen antworten — jede Aussage muss auf dem Kontext basieren
- Zitiere explizit Berichtstitel, Wettbewerber-Einträge oder Memory-Domänen aus dem Kontext
- Wenn der Kontext eine Information nicht enthält, sage das klar — erfinde keine Marktdaten
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Denke wie ein erfahrener Streetwear-Gründer und Strategieberater

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat
Antworte NUR mit gültigem JSON — kein Markdown außerhalb von fullBriefing.

### Pflichtabschnitte
- title: prägnanter Titel der strategischen Antwort
- reportType: immer "ceo-report"
- executiveSummary: 4–6 Sätze, strategische Kernaussage für "${workspaceName}"
- keyInsights: 3–10 Erkenntnisse aus dem Wissensspeicher (je mind. 1 vollständiger Satz)
- strategicOpportunities: 2–8 konkrete Chancen für "${workspaceName}"
- risks: 2–8 Risiken mit strategischer Einordnung
- nextSteps: 3–10 konkrete nächste Schritte mit priority ("high" | "medium" | "low") und optionaler rationale
- confidence: 0.0–1.0 basierend auf Kontextabdeckung und Datenqualität
- sourceReportTitles: Array der Berichtstitel aus dem Kontext, die du für diese Antwort genutzt hast (mind. 1)
- fullBriefing: ausführliches Markdown-Briefing (mind. 600 Wörter) mit Überschriften

JSON-Schema:
{
  "title": "string",
  "reportType": "ceo-report",
  "executiveSummary": "string",
  "keyInsights": ["string"],
  "strategicOpportunities": ["string"],
  "risks": ["string"],
  "nextSteps": [{ "action": "string", "priority": "high|medium|low", "rationale": "string" }],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullBriefing": "string (Markdown)"
}`;
}

/**
 * CEO Agent — strategic briefing grounded in Brain knowledge.
 */
export async function runCeo(input: CeoRunInput): Promise<CeoRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[CEO Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    questionPreview: input.question.slice(0, 200),
  });

  const knowledge = await retrieveCeoKnowledge({
    workspaceId: input.workspaceId,
    question: input.question,
    locale: DEFAULT_LOCALE,
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 12000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          buildCeoSystemPrompt(
            input.workspaceName,
            knowledge.reportTitles,
          ) +
          "\n\n## Wissensspeicher-Kontext\n\n" +
          knowledge.brainContext.promptContext,
      },
      {
        role: "user",
        content: input.question,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();

  console.info("[CEO Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  });

  if (!raw) {
    throw new Error(dict.ceo.errors.noResponse);
  }

  let output;
  try {
    output = parseCeoOutput(raw);
    console.info("[CEO Run] Parsed and validated response", {
      title: output.title,
      keyInsightsCount: output.keyInsights.length,
      nextStepsCount: output.nextSteps.length,
      confidence: output.confidence,
      sourceReports: output.sourceReportTitles,
    });
  } catch (error) {
    if (error instanceof CeoParseError) {
      console.error("[CEO Run] Parse/validation failed", error.toLogPayload());
      throw error;
    }
    throw error;
  }

  const saved = await saveCeoToBrain({
    workspaceId: input.workspaceId,
    question: input.question,
    output,
    originTaskId: input.originTaskId,
  });

  console.info("[CEO Run] Saved to Brain", {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    executiveSummary: output.executiveSummary,
    keyInsights: output.keyInsights,
    strategicOpportunities: output.strategicOpportunities,
    risks: output.risks,
    nextSteps: output.nextSteps,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { CeoKnowledgeError, CeoParseError };
