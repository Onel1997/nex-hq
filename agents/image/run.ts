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
  collectionName: string,
  campaignName: string,
  projectName: string,
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

## Kollektions-Identität (EINZIGE Quelle — aus CEO/Design-Berichten)
- collectionName: "${collectionName}" (NIEMALS ändern, keine zweite Kampagne erfinden)
- campaignName: "${campaignName}"
- projectName: "${projectName}"
- Jeder Asset-Titel: "${collectionName} — {Asset Type}" (z. B. "${collectionName} — Hero Banner")
- VERBOTEN als Namen: Drop, Summer Collection, Collection, Project, Milaene Creative Production

## Ausgabeformat (STRIKT JSON, schemaVersion "2.0")
- reportType: "image-project"
- KEIN Markdown, KEINE Code-Fences

### CORE PACKAGE (Pflicht — genau 8 Assets, keine Duplikate)
corePackage[] mit package: "core":
1. hero_banner — Hero Banner (id: core-hero-banner)
2. product_mockup — Product Mockup (variant: hero_product, id: core-mockup-hero_product)
3. product_mockup — Flat Lay (variant: flat_lay, id: core-mockup-flat_lay)
4. product_mockup — Lifestyle Mockup (variant: lifestyle, id: core-mockup-lifestyle)
5. campaign_key_visual — Campaign Key Visual (id: core-campaign-key-visual)
6. instagram_carousel — Instagram Carousel (id: core-instagram-carousel)
7. reels_concept — Reels Concept (id: core-reels-concept)
8. tiktok_concept — TikTok Concept (id: core-tiktok-concept)

### ADVANCED PACKAGE (Sekundär — genau 5 Assets, gleiche collectionName)
advancedPackage[] mit package: "advanced" — erweitert dieselbe Kollektion, keine zweite Kampagne:
1. landing_section — Landing Hero (id: advanced-landing-hero, variant: hero)
2. landing_section — Landing Product Grid (id: advanced-landing-product-grid, variant: product_grid)
3. instagram_grid — Instagram Grid (id: advanced-instagram-grid)
4. campaign_visual — Paid Social Visual (id: advanced-campaign-social)
5. launch_teaser — Launch Teaser (id: advanced-launch-teaser)

### Weitere Pflichtfelder
- moodboard (OBJEKT — niemals String):
  {
    "visualDirection": "string min 80 Zeichen",
    "aestheticKeywords": ["string", ...], // 3–12
    "colorSystem": ["Name #HEX", ...], // 2–8
    "materialReferences": ["string", ...], // 2–8
    "photographyStyle": "string min 40 Zeichen"
  }
- palette (OBJEKT — niemals Array):
  {
    "primary": "Name #HEX",
    "secondary": "Name #HEX",
    "accent": "Name #HEX",
    "background": "Name #HEX",
    "text": "Name #HEX"
  }
- campaignShots[] (min 12, max 24), confidence (0–1), sourceReportTitles[] (min 1), fullProject (Markdown min 600 Zeichen)

### VERBOTEN (Legacy V1 — nicht ausgeben)
- heroBanner, productMockups, campaignVisuals, landingAssets, instagramGrid, reelsConcepts, tiktokConcepts
- moodboard als String, palette als Array

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
    workspaceName: input.workspaceName,
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
            knowledge.collectionIdentity.collectionName,
            knowledge.collectionIdentity.campaignName,
            knowledge.collectionIdentity.projectName,
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
    output = parseImageOutput(raw, {
      collectionIdentity: knowledge.collectionIdentity,
    });
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
    originTaskId: input.originTaskId,
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
