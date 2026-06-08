import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { DesignParseError, parseDesignOutput } from "./parse-output";
import {
  DesignKnowledgeError,
  retrieveDesignKnowledge,
} from "./retrieve-context";
import { saveDesignToBrain } from "./save";
import type { DesignRunInput, DesignRunResult } from "./types";

function buildDesignSystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
  loadedTags: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  return `Du bist der Design-Agent von NexHQ — Creative Director für den Workspace "${workspaceName}".

## Deine Rolle
- Entwickle vollständige Fashion-Kollektionskonzepte für Streetwear/Luxury-Streetwear
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext (Trend-, Wettbewerbs-, Pricing- und CEO-Berichte plus Markenregeln)
- Du darfst NIEMALS nur aus allgemeinem Modellwissen antworten — jedes Design-Element muss auf Intelligence oder Markenkontext basieren
- Zitiere explizit Berichtstitel, die deine Designentscheidungen begründen
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Denke wie ein Creative Director mit strategischem Verständnis für "${workspaceName}"

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences, KEIN Kommentar außerhalb des JSON
- Das Antwortformat ist json_object — alle Pflichtfelder müssen im Root-Objekt stehen
- Markdown ist NUR innerhalb des Feldes fullConcept erlaubt

### Pflichtabschnitte
- title: prägnanter Titel des Kollektionskonzepts
- reportType: immer "design-report"
- collectionName: Name der Kollektion
- collectionStory: 4–8 Sätze Narrativ — Mood, kultureller Kontext, Zielgruppe, Differenzierung
- colorPalette: 3–8 Farben mit name, optional hex, role (z. B. "Primär", "Akzent", "Neutral")
- silhouettes: 3–10 Silhouetten-Beschreibungen (Fit, Proportionen, Details)
- productLineup: 4–14 Produkte mit name, category, description
- heroProducts: 2–6 Hero-SKUs mit name, description, rationale (warum Lead-Produkt)
- materials: 3–10 Materialien und Stoffqualitäten
- designDirection: ausführliche visuelle Richtung (Ästhetik, Grafik, Details, Brand-Fit)
- launchRecommendations: 3–8 konkrete Launch-Empfehlungen (Drop-Format, Storytelling, Kanäle)
- confidence: 0.0–1.0 basierend auf Kontextabdeckung
- sourceReportTitles: Array der genutzten Berichtstitel (mind. 1)
- fullConcept: ausführliches Markdown-Konzept (mind. 800 Wörter) mit Überschriften

JSON-Schema:
{
  "title": "string",
  "reportType": "design-report",
  "collectionName": "string",
  "collectionStory": "string",
  "colorPalette": [{ "name": "string", "hex": "string", "role": "string" }],
  "silhouettes": ["string"],
  "productLineup": [{ "name": "string", "category": "string", "description": "string" }],
  "heroProducts": [{ "name": "string", "description": "string", "rationale": "string" }],
  "materials": ["string"],
  "designDirection": "string",
  "launchRecommendations": ["string"],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullConcept": "string (Markdown)"
}`;
}

/**
 * Design Agent — generate collection concept grounded in Brain intelligence.
 */
export async function runDesign(
  input: DesignRunInput,
): Promise<DesignRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[Design Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    briefPreview: input.brief.slice(0, 200),
  });

  const knowledge = await retrieveDesignKnowledge({
    workspaceId: input.workspaceId,
    brief: input.brief,
    locale: DEFAULT_LOCALE,
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.45,
    max_tokens: 14000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          buildDesignSystemPrompt(
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

  console.info("[Design Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    intelligenceReports: knowledge.intelligenceReportCount,
  });
  console.info("[Design Run] Raw OpenAI response:", raw);

  if (!raw) {
    throw new Error(dict.design.errors.noResponse);
  }

  let output;
  try {
    output = parseDesignOutput(raw);
    console.info("[Design Run] Parsed and validated response", {
      title: output.title,
      collectionName: output.collectionName,
      productCount: output.productLineup.length,
      heroCount: output.heroProducts.length,
      confidence: output.confidence,
      sourceReports: output.sourceReportTitles,
    });
    console.info(
      "[Design Run] Validated output:",
      JSON.stringify(output, null, 2),
    );
  } catch (error) {
    if (error instanceof DesignParseError) {
      console.error("[Design Run] Parse/validation failed", error.toLogPayload());
      console.error(
        "[Design Run] Validation issues:",
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error("[Design Run] Detailed error:\n", error.toDetailedMessage());
      throw error;
    }
    throw error;
  }

  const saved = await saveDesignToBrain({
    workspaceId: input.workspaceId,
    brief: input.brief,
    output,
  });

  console.info("[Design Run] Saved to Brain", {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    collectionName: output.collectionName,
    collectionStory: output.collectionStory,
    colorPalette: output.colorPalette,
    silhouettes: output.silhouettes,
    productLineup: output.productLineup,
    heroProducts: output.heroProducts,
    materials: output.materials,
    designDirection: output.designDirection,
    launchRecommendations: output.launchRecommendations,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { DesignKnowledgeError };
