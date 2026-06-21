import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatAgentBusinessRules, loadBusinessProfile } from "@/lib/business";
import { getOpenAIClient } from "@/lib/openai/client";
import { ImageParseError, parseImageOutput } from "./parse-output";
import {
  ImageKnowledgeError,
  retrieveImageKnowledge,
} from "./retrieve-context";
import { saveImageToBrain } from "./save";
import type { ImageRunInput, ImageRunResult } from "./types";
import { STUDIO_SPECS_BY_CATEGORY } from "./studio-specs";

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

  const categoryBrief = Object.entries(STUDIO_SPECS_BY_CATEGORY)
    .map(([category, specs]) => {
      const types = [...new Set(specs.map((s) => s.assetType))].join(", ");
      return `  - ${category}: ${specs.length} assets (${types})`;
    })
    .join("\n");

  return `Du bist der Image-Agent von NexHQ — Milaenes Creative Studio für den Workspace "${workspaceName}".

## Deine Rolle
Du bist KEIN Prompt-Generator. Du bist:
- Fashion Photographer
- Creative Studio Director
- Campaign Production Lead

Du planst eine echte Fashion-Produktion basierend auf:
- Design Agent Creative Brief (Kollektion, Theme, Story, Produkte, Farben, Materialien, Visual Keywords, Fotografie-Stil, Image Prompts, Campaign Ideas)
- Live Shopify Katalog (echte Produkte, Kategorien, Farben, Kollektionen, Preise)
- CEO-, Content- und Marketing-Intelligence

## REAL PRODUCT RULES (PFLICHT)
- Erfinde KEINE Produkte, Kategorien oder Farben
- productName, color, material MÜSSEN aus SHOPIFY KNOWLEDGE oder Design Brief stammen
- Jeder productionAsset referenziert ein echtes Milaene Produkt
- Keine Mock-Produkte. Keine erfundenen Preise.

## OUTPUT TYPES (Schema V3 — productionAssets)
${categoryBrief}

## ASSET STRUCTURE (jedes productionAsset)
- assetType, productName, collection, color, material
- location, lighting, photographyStyle, cameraStyle
- prompt { midjourney, openai, flux } — mindestens 80 Zeichen, Art-Direction-Qualität
- priority: hero | core | support
- status: pending (bis generiert)

## PROMPT QUALITY — Fashion Production Team
Jeder Prompt liest sich wie ein Shot Brief vom Creative Director:
- Produkt: echter Name aus Shopify (z.B. "Faith Oversized Tee")
- Material: echter Stoff (z.B. "Cream cotton")
- Kollektion: echte Collection (z.B. "Love Story collection")
- Kamera: 35mm full-frame / medium format, Objektiv, Blende
- Licht: Studio key/fill, overcast urban, golden hour rim
- Location: Studio cyclorama, urban rooftop, concrete architecture
- Mood: editorial streetwear, urban luxury, scarcity drop
- Visual quality bar: premium fashion brands, realistic commercial photography
- Campaigns müssen Premium Streetwear Positionierung widerspiegeln — editorial, urban luxury

Beispiel: "Faith Oversized Tee · Cream cotton · Love Story collection · Editorial streetwear campaign · 35mm full-frame 50mm f/1.4 · soft studio key with urban rim light · concrete rooftop at dusk"

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte
${reportList}

## Kollektions-Identität (EINZIGE Quelle)
- collectionName: "${collectionName}" (NIEMALS ändern)
- campaignName: "${campaignName}"
- projectName: "${projectName}"

## Ausgabeformat (STRIKT JSON, schemaVersion "3.0")
- reportType: "image-project"
- KEIN Markdown außerhalb von fullProject

Pflichtfelder:
- title, projectName, collectionName
- visualDirection (min 80 Zeichen — Creative Studio Gesamtrichtung)
- moodboard { visualDirection, aestheticKeywords, colorSystem, materialReferences, photographyStyle }
- palette { primary, secondary, accent, background, text } — Name + HEX
- productionAssets[] (min 18, max 48) — alle 5 Output-Kategorien abdecken
- lookbookShots[] (min 4) — models, location, outfitProducts (echte Produktnamen), styling, purpose
- confidence, sourceReportTitles[], fullProject (Markdown min 600 Zeichen)

Jedes productionAsset:
{
  "id": "prod-studio-hero",
  "assetType": "studio_shot",
  "outputCategory": "product_photography",
  "productName": "string (Shopify)",
  "collection": "${collectionName}",
  "color": "string (Shopify/Design)",
  "material": "string (Shopify/Design)",
  "location": "string",
  "lighting": "string",
  "photographyStyle": "string",
  "cameraStyle": "string",
  "prompt": { "midjourney": "...", "openai": "...", "flux": "..." },
  "priority": "hero|core|support",
  "status": "pending",
  "title": "${collectionName} — Hero Studio Shot",
  "platform": "ecommerce",
  "dimensions": "2048x2048"
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

  const businessProfile = await loadBusinessProfile(input.workspaceId);

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
          (knowledge.designCreativeBrief
            ? "\n\n## Design Agent — Creative Brief (PRIMÄRE QUELLE)\n\n" +
              knowledge.designCreativeBrief +
              (knowledge.designImageInputs?.imagePrompts.length
                ? "\n\n### Design Image Prompts\n" +
                  knowledge.designImageInputs.imagePrompts
                    .map((p) => `- ${p}`)
                    .join("\n")
                : "") +
              (knowledge.designImageInputs?.visualKeywords.length
                ? "\n\n### Visual Keywords\n" +
                  knowledge.designImageInputs.visualKeywords
                    .map((k) => `- ${k}`)
                    .join("\n")
                : "")
            : "") +
          "\n\n" +
          formatAgentBusinessRules("image", businessProfile) +
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
      shopifyKnowledge: knowledge.shopifyKnowledge,
      photographyStyle: knowledge.designImageInputs?.stylingDirection,
      visualKeywords: knowledge.designImageInputs?.visualKeywords,
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
    collectionName: output.collectionName,
    schemaVersion: output.schemaVersion,
    visualDirection: output.visualDirection,
    moodboard: output.moodboard,
    palette: output.palette,
    productionAssets: output.productionAssets,
    lookbookShots: output.lookbookShots,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    primaryReportCounts: knowledge.primaryReportCounts,
  };
}

export { ImageKnowledgeError };
