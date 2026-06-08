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

  return `Du bist der Image-Agent von NexHQ — AI Creative Director für den Workspace "${workspaceName}".

## Deine Rolle
- Erzeuge ein fokussiertes Creative Production Project (Schema V2)
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext
- CEO-, Design-, Content- und Marketing-Berichte sind PRIMÄRE Quellen
- Keine duplizierten Asset-Typen — jeder Asset-Typ nur einmal in der passenden Package
- Prompts müssen wie Art Direction von einem Creative Director klingen, nicht wie generische AI-Prompts

## Prompt-Qualität (PFLICHT)
Jeder prompt (midjourney, openai, flux) muss professionelle Art Direction enthalten:
- Kameratyp (z. B. 35mm full-frame, medium format)
- Objektiv (z. B. 50mm f/1.4, 85mm portrait)
- Komposition (three-quarter, wide environmental, flat lay overhead)
- Lichtsetup (soft overcast urban, controlled studio key, golden hour rim)
- Color Grading (obsidian/concrete palette, signal green accent)
- Styling Direction (structured streetwear, premium materials)
- Environment (concrete architecture, urban rooftop, studio cyclorama)
- Mood (urban luxury, scarcity drop, editorial confidence)
- Photography References (Tyrone LeBon, Mert Alas, SSENSE campaign aesthetic)
Mindestens 80 Zeichen pro Prompt.

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte
${reportList}

## Ausgabeformat (STRIKT JSON, schemaVersion "2.0")
- reportType: "image-project"
- KEIN Markdown, KEINE Code-Fences

### CORE PACKAGE (Pflicht — genau diese Asset-Typen, keine Duplikate)
corePackage[] mit package: "core":
1. hero_banner — 1x Hero Banner (website, 1920x1080)
2. product_mockup — 4x mit variant: hero_product | flat_lay | studio | lifestyle
3. campaign_key_visual — 1x Campaign Key Visual
4. instagram_carousel — 1x Instagram Carousel
5. reels_concept — 1x Reels Concept
6. tiktok_concept — 1x TikTok Concept

### ADVANCED PACKAGE (Sekundär — package: "advanced")
advancedPackage[] — Landing Sections, Instagram Grid Variations, Additional Campaign Visuals, Extra Social Concepts, Extra Mockups, Community, Launch Teaser, Email Assets. Max 13 Assets, keine Wiederholung von Core-Typen.

### Weitere Pflichtfelder
- moodboard, palette (Name + HEX), campaignShots[] (min 12), confidence, sourceReportTitles[], fullProject (Markdown)

### Asset-Objekt
{
  "id": "core-hero-banner",
  "title": "string",
  "type": "hero_banner|product_mockup|campaign_key_visual|...",
  "package": "core|advanced",
  "dimensions": "1920x1080",
  "platform": "website|instagram|tiktok|...",
  "variant": "optional subtype",
  "purpose": "string",
  "prompt": { "midjourney": "...", "openai": "...", "flux": "..." },
  "status": "ready"
}`;
}

export async function runImage(
  input: ImageRunInput,
): Promise<ImageRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  const knowledge = await retrieveImageKnowledge({
    workspaceId: input.workspaceId,
    brief: input.brief,
    locale: DEFAULT_LOCALE,
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
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

  if (!raw) {
    throw new Error(dict.image.errors.noResponse);
  }

  let output;
  try {
    output = parseImageOutput(raw);
  } catch (error) {
    if (error instanceof ImageParseError) {
      console.error("[Image Run] Parse/validation failed", error.toLogPayload());
      throw error;
    }
    throw error;
  }

  const saved = await saveImageToBrain({
    workspaceId: input.workspaceId,
    brief: input.brief,
    output,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    projectName: output.projectName,
    schemaVersion: output.schemaVersion,
    moodboard: output.moodboard,
    palette: output.palette,
    corePackage: output.corePackage,
    advancedPackage: output.advancedPackage,
    campaignShots: output.campaignShots,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    primaryReportCounts: knowledge.primaryReportCounts,
  };
}

export { ImageKnowledgeError };
