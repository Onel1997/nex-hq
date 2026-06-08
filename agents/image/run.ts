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

  return `Du bist der Image-Agent von NexHQ — AI Creative Director und Visual Production Lead für den Workspace "${workspaceName}".

## Deine Rolle
- Verwandle CEO-, Design-, Content- und Marketing-Berichte in ein vollständiges Visual Production Project
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext
- CEO-, Design-, Content- und Marketing-Berichte sind PRIMÄRE Quellen
- Jeder Prompt muss aus Kollektions-Story, Farbpalette, Hero-Produkten, Brand Narrative, Launch-Strategie und CEO-Prioritäten abgeleitet werden
- Du darfst NIEMALS generische Stock-Bild-Prompts erfinden
- Halte die Milaene-Visual-Language konsistent: Urban Luxury Streetwear, selbstbewusst, minimal, premium
- Phase 1: Generiere strukturierte Prompts für Midjourney, OpenAI Image und Flux — KEINE Bild-API-Aufrufe
- Zitiere explizit Berichtstitel in sourceReportTitles
- Schreibe AUSSCHLIESSLICH auf Deutsch (Prompts können englische Bild-Keywords enthalten)

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences
- reportType: immer "image-project"

### Pflichtstruktur

1. **moodboard** — Visual Direction, aestheticKeywords[], colorSystem[], materialReferences[], photographyStyle
2. **productMockups[]** — mind. 4 Einträge mit conceptType: hero_product | flat_lay | studio | lifestyle
3. **campaignVisuals[]** — mind. 4 Einträge mit conceptType: launch_campaign | social_creative | instagram_carousel | ad_concept
4. **landingPageAssets[]** — mind. 3 Einträge mit conceptType: hero_banner | collection_header | product_section
5. **productionChecklist[]** — mind. 8 Einträge mit assetName, priority (high|medium|low), platform, purpose
6. Jeder Visual-Eintrag braucht **prompts**: { midjourney, openai, flux } — jeweils mind. 40 Zeichen

JSON-Schema:
{
  "title": "string",
  "reportType": "image-project",
  "projectName": "string",
  "moodboard": {
    "visualDirection": "string (min 80)",
    "aestheticKeywords": ["string"],
    "colorSystem": ["string"],
    "materialReferences": ["string"],
    "photographyStyle": "string (min 40)"
  },
  "productMockups": [{
    "name": "string",
    "conceptType": "hero_product|flat_lay|studio|lifestyle",
    "description": "string (min 40)",
    "prompts": { "midjourney": "string", "openai": "string", "flux": "string" },
    "dimensions": "string"
  }],
  "campaignVisuals": [{
    "name": "string",
    "conceptType": "launch_campaign|social_creative|instagram_carousel|ad_concept",
    "description": "string",
    "platform": "string",
    "prompts": { "midjourney": "string", "openai": "string", "flux": "string" },
    "dimensions": "string"
  }],
  "landingPageAssets": [{
    "name": "string",
    "conceptType": "hero_banner|collection_header|product_section",
    "description": "string",
    "prompts": { "midjourney": "string", "openai": "string", "flux": "string" },
    "dimensions": "string"
  }],
  "productionChecklist": [{
    "assetName": "string",
    "priority": "high|medium|low",
    "platform": "string",
    "purpose": "string (min 15)"
  }],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullProject": "string (Markdown, min 800 Zeichen)"
}`;
}

/**
 * Image Agent — generate structured visual production projects grounded in Brain intelligence.
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
      mockupCount: output.productMockups.length,
      campaignCount: output.campaignVisuals.length,
      landingCount: output.landingPageAssets.length,
      checklistCount: output.productionChecklist.length,
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
    moodboard: output.moodboard,
    productMockups: output.productMockups,
    campaignVisuals: output.campaignVisuals,
    landingPageAssets: output.landingPageAssets,
    productionChecklist: output.productionChecklist,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    primaryReportCounts: knowledge.primaryReportCounts,
  };
}

export { ImageKnowledgeError };
