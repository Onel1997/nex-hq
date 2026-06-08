import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { ImageParseError, parseImageOutput } from "./parse-output";
import {
  ImageKnowledgeError,
  retrieveImageKnowledge,
} from "./retrieve-context";
import { saveImageToBrain } from "./save";
import type { ImageRunInput, ImageRunResult } from "./types";

function buildImageSystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
  loadedTags: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  return `Du bist der Image-Agent von NexHQ — AI Creative Director und Art Director für den Workspace "${workspaceName}" (Marke: Milaene).

## Deine Rolle
- Verwandle Design-, Content-, Marketing- und CEO-Berichte in strukturierte Image-Generation-Projekte
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext
- Design-, Content- und Marketing-Berichte sind PRIMÄRE Quellen — jeder Prompt muss daraus abgeleitet werden
- Wenn eine Kollektion existiert (z. B. Urban Echoes), MÜSSEN alle Prompts verwenden:
  * Kollektions-Story aus Design-Bericht
  * Farbpalette aus Design-Bericht
  * Hero-Produkte aus Design-Bericht
  * Design-Richtung aus Design-Bericht
  * Marketing-Strategie aus Marketing-Bericht
  * Brand Narrative und Copy aus Content-Bericht
- Du darfst NIEMALS generische Stock-Bild-Prompts erfinden — keine Platzhalter, keine erfundenen Produkte
- Halte die Milaene-Visual-Language konsistent: Urban Luxury Streetwear, selbstbewusst, minimal, premium
- Phase 1: Generiere NUR strukturierte Prompts — KEINE Bild-API-Aufrufe
- Zitiere explizit Berichtstitel in sourceReportTitles
- Schreibe AUSSCHLIESSLICH auf Deutsch (Prompts können englische Bild-Keywords enthalten)
- Denke wie ein Senior Creative Director für "${workspaceName}"

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Zu generierende Asset-Kategorien
1. Moodboard-Prompts (assetType: moodboard)
2. Produkt-Mockup-Prompts (hoodie_mockup, tshirt_mockup, cargo_mockup)
3. Campaign-Visual-Prompts (campaign_visual)
4. Landing-Page-Hero-Prompts (landing_page_hero)
5. Social-Media-Creative-Prompts (instagram_post, instagram_story, tiktok_cover, email_banner)
6. Lookbook-Prompts (lookbook_page)

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences, KEIN Kommentar außerhalb des JSON
- Das Antwortformat ist json_object — alle Pflichtfelder müssen im Root-Objekt stehen
- Markdown ist NUR innerhalb des Feldes fullProject erlaubt

### Pflichtabschnitte
- title: prägnanter Titel des Image-Projekts
- reportType: immer "image-report"
- projectName: Name des visuellen Projekts (z. B. "Urban Echoes — SS26 Visual System")
- visualDirection: ausführliche Creative-Direction (mind. 100 Zeichen)
- collectionStory: Kollektions-Story aus Design-Bericht (mind. 80 Zeichen)
- moodboard: Moodboard-Creative-Brief als Text (mind. 80 Zeichen)
- campaignConcept: Kampagnen-Visual-Konzept aus Marketing-Bericht (mind. 80 Zeichen)
- assets: Array (8–48) mit assetName, assetType, purpose, platform, prompt (mind. 50 Zeichen), dimensions, styleNotes
- confidence: 0.0–1.0 basierend auf Kontextabdeckung
- sourceReportTitles: Array der genutzten Berichtstitel (mind. 1)
- fullProject: ausführliches Markdown-Image-Projekt (mind. 800 Zeichen)

### Erlaubte assetType-Werte
moodboard, hoodie_mockup, tshirt_mockup, cargo_mockup, campaign_visual, landing_page_hero, instagram_post, instagram_story, tiktok_cover, email_banner, lookbook_page

JSON-Schema:
{
  "title": "string",
  "reportType": "image-report",
  "projectName": "string",
  "visualDirection": "string",
  "collectionStory": "string",
  "moodboard": "string",
  "campaignConcept": "string",
  "assets": [{ "assetName": "string", "assetType": "moodboard|hoodie_mockup|...", "purpose": "string", "platform": "string", "prompt": "string", "dimensions": "string", "styleNotes": "string" }],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullProject": "string (Markdown)"
}`;
}

/**
 * Image Agent — generate structured image prompts grounded in Brain intelligence.
 * Phase 1: prompts only — no image API calls.
 */
export async function runImage(
  input: ImageRunInput,
): Promise<ImageRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[Image Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    briefPreview: input.brief.slice(0, 200),
  });

  const knowledge = await retrieveImageKnowledge({
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
          buildImageSystemPrompt(
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

  console.info("[Image Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    primaryReportCounts: knowledge.primaryReportCounts,
  });
  console.info("[Image Run] Raw OpenAI response:", raw);

  if (!raw) {
    throw new Error(dict.image.errors.noResponse);
  }

  let output;
  try {
    output = parseImageOutput(raw);
    console.info("[Image Run] Parsed and validated response", {
      title: output.title,
      projectName: output.projectName,
      assetCount: output.assets.length,
      confidence: output.confidence,
      sourceReports: output.sourceReportTitles,
    });
    console.info(
      "[Image Run] Validated output:",
      JSON.stringify(output, null, 2),
    );
  } catch (error) {
    if (error instanceof ImageParseError) {
      console.error("[Image Run] Parse/validation failed", error.toLogPayload());
      console.error(
        "[Image Run] Validation issues:",
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error("[Image Run] Detailed error:\n", error.toDetailedMessage());
      throw error;
    }
    throw error;
  }

  const saved = await saveImageToBrain({
    workspaceId: input.workspaceId,
    brief: input.brief,
    output,
  });

  console.info("[Image Run] Saved to Brain", {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    projectName: output.projectName,
    visualDirection: output.visualDirection,
    collectionStory: output.collectionStory,
    moodboard: output.moodboard,
    campaignConcept: output.campaignConcept,
    assets: output.assets,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { ImageKnowledgeError };
