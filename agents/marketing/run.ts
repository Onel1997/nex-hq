import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { MarketingParseError, parseMarketingOutput } from "./parse-output";
import {
  MarketingKnowledgeError,
  retrieveMarketingKnowledge,
} from "./retrieve-context";
import { saveMarketingToBrain } from "./save";
import type { MarketingRunInput, MarketingRunResult } from "./types";

function buildMarketingSystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
  loadedTags: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  return `Du bist der Marketing-Agent von NexHQ — Growth-Stratege für den Workspace "${workspaceName}".

## Deine Rolle
- Erstelle vollständige Launch- und Kampagnenpläne für Streetwear/Luxury-Streetwear Drops
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext (Research-, CEO- und Design-Berichte plus Markenregeln)
- Du darfst NIEMALS nur aus allgemeinem Modellwissen antworten — jede Empfehlung muss auf Intelligence basieren
- Zitiere explizit Berichtstitel, die deine Marketingentscheidungen begründen
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Denke wie ein Growth-Lead mit strategischem Verständnis für "${workspaceName}"

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences, KEIN Kommentar außerhalb des JSON
- Das Antwortformat ist json_object — alle Pflichtfelder müssen im Root-Objekt stehen
- Markdown ist NUR innerhalb des Feldes fullPlan erlaubt

### Pflichtabschnitte
- title: prägnanter Titel des Marketing-Plans
- reportType: immer "marketing-report"
- launchStrategy: ausführliche Launch-Strategie (Tease → Reveal → Countdown → Drop)
- contentPillars: 3–8 Content-Säulen als String-Array
- tiktokIdeas: GENAU 20 konkrete TikTok-Content-Ideen (je mind. 20 Zeichen)
- instagramIdeas: GENAU 20 konkrete Instagram-Content-Ideen (je mind. 20 Zeichen)
- influencerStrategy: Micro-/Macro-Influencer-Strategie, Seeding, UGC
- emailCampaignPlan: 3–8 E-Mail-Phasen mit phase, subject, objective, content
- communityBuildingPlan: Community-Aufbau über VIP, Discord, Events, UGC
- contentCalendar30Day: GENAU 30 Einträge (day 1–30) mit title, channel, format, description
- launchKpis: 4–12 KPIs mit metric, target, rationale
- budgetAllocation: 4–10 Posten mit category, allocation (z. B. "25%"), rationale
- confidence: 0.0–1.0 basierend auf Kontextabdeckung
- sourceReportTitles: Array der genutzten Berichtstitel (mind. 1)
- fullPlan: ausführlicher Markdown-Plan (mind. 800 Wörter)

JSON-Schema:
{
  "title": "string",
  "reportType": "marketing-report",
  "launchStrategy": "string",
  "contentPillars": ["string"],
  "tiktokIdeas": ["string x20"],
  "instagramIdeas": ["string x20"],
  "influencerStrategy": "string",
  "emailCampaignPlan": [{ "phase": "string", "subject": "string", "objective": "string", "content": "string" }],
  "communityBuildingPlan": "string",
  "contentCalendar30Day": [{ "day": 1, "title": "string", "channel": "string", "format": "string", "description": "string" }],
  "launchKpis": [{ "metric": "string", "target": "string", "rationale": "string" }],
  "budgetAllocation": [{ "category": "string", "allocation": "string", "rationale": "string" }],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullPlan": "string (Markdown)"
}`;
}

/**
 * Marketing Agent — generate campaign plan grounded in Brain intelligence.
 */
export async function runMarketing(
  input: MarketingRunInput,
): Promise<MarketingRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[Marketing Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    briefPreview: input.brief.slice(0, 200),
  });

  const knowledge = await retrieveMarketingKnowledge({
    workspaceId: input.workspaceId,
    brief: input.brief,
    locale: DEFAULT_LOCALE,
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 16000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          buildMarketingSystemPrompt(
            input.workspaceName,
            knowledge.reportTitles,
            knowledge.loadedTags,
          ) +
          "\n\n## Wissensspeicher-Kontext\n\n" +
          knowledge.brainContext.promptContext,
      },
      {
        role: "user",
        content: input.brief,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();

  console.info("[Marketing Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    intelligenceReports: knowledge.intelligenceReportCount,
  });
  console.info("[Marketing Run] Raw OpenAI response:", raw);

  if (!raw) {
    throw new Error(dict.marketing.errors.noResponse);
  }

  let output;
  try {
    output = parseMarketingOutput(raw);
    console.info("[Marketing Run] Parsed and validated response", {
      title: output.title,
      tiktokCount: output.tiktokIdeas.length,
      instagramCount: output.instagramIdeas.length,
      calendarDays: output.contentCalendar30Day.length,
      confidence: output.confidence,
      sourceReports: output.sourceReportTitles,
    });
    console.info(
      "[Marketing Run] Validated output:",
      JSON.stringify(output, null, 2),
    );
  } catch (error) {
    if (error instanceof MarketingParseError) {
      console.error("[Marketing Run] Parse/validation failed", error.toLogPayload());
      console.error(
        "[Marketing Run] Validation issues:",
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error("[Marketing Run] Detailed error:\n", error.toDetailedMessage());
      throw error;
    }
    throw error;
  }

  const saved = await saveMarketingToBrain({
    workspaceId: input.workspaceId,
    brief: input.brief,
    output,
  });

  console.info("[Marketing Run] Saved to Brain", {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    launchStrategy: output.launchStrategy,
    contentPillars: output.contentPillars,
    tiktokIdeas: output.tiktokIdeas,
    instagramIdeas: output.instagramIdeas,
    influencerStrategy: output.influencerStrategy,
    emailCampaignPlan: output.emailCampaignPlan,
    communityBuildingPlan: output.communityBuildingPlan,
    contentCalendar30Day: output.contentCalendar30Day,
    launchKpis: output.launchKpis,
    budgetAllocation: output.budgetAllocation,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { MarketingKnowledgeError };
