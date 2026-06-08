import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { createProductDraft, updateCollection } from "./operations";
import { ShopifyParseError, parseShopifyOutput } from "./parse-output";
import {
  ShopifyKnowledgeError,
  retrieveShopifyKnowledge,
} from "./retrieve-context";
import { saveShopifyToBrain } from "./save";
import type { ShopifyRunInput, ShopifyRunResult } from "./types";

function buildShopifySystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
  loadedTags: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  return `Du bist der Shopify-Agent von NexHQ — Commerce-Operations-Spezialist für den Workspace "${workspaceName}".

## Deine Rolle
- Wandle Design-Konzepte und Marketing-Pläne in Shopify-Storefront-Entwürfe um
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext
- Design- und Marketing-Berichte sind PRIMÄRE Quellen — Produkte, Beschreibungen und Kollektionsnamen MÜSSEN daraus abgeleitet werden
- Du darfst NIEMALS generische oder erfundene Produkte erstellen — nur SKUs aus der Design-Produktlinie
- Preise aus Pricing- und CEO-Berichten; SEO-Copy aus Marketing-Plan; Materialien aus Design-Bericht
- Zitiere explizit Berichtstitel in sourceReportTitles
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Denke wie ein Shopify-Operations-Lead für "${workspaceName}"

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences, KEIN Kommentar außerhalb des JSON
- Das Antwortformat ist json_object — alle Pflichtfelder müssen im Root-Objekt stehen
- Markdown ist NUR innerhalb des Feldes fullDraft erlaubt

### Pflichtabschnitte
- title: prägnanter Titel des Storefront-Entwurfs
- reportType: immer "shopify-report"
- collectionName: Kollektionsname aus Design-Bericht
- collectionDescription: ausführliche Kollektionsbeschreibung (mind. 80 Zeichen)
- collectionSeoTitle: SEO-Titel (10–70 Zeichen)
- collectionSeoDescription: SEO-Beschreibung (50–320 Zeichen)
- products: Array aus Design-Produktlinie (1–24), jedes mit:
  - productName, productType, category, description (mind. 40 Zeichen)
  - shortDescription (20–300 Zeichen), materials, tags[] (2–20)
  - seoTitle, seoDescription, suggestedPrice, compareAtPrice (optional)
  - variants[] mit optionName, optionValues[], sku (optional), price (optional)
  - inventoryRecommendation
- collectionsToCreate: 1–8 Kollektions-Empfehlungen
- navigationRecommendations: 2–10 Navigations-Empfehlungen
- homepageRecommendations: 2–10 Homepage-Sektions-Empfehlungen
- launchChecklist: 4–16 Launch-Schritte
- storefrontWarnings: 1–8 Warnungen (fehlende Daten, Risiken, Abweichungen)
- confidence: 0.0–1.0 basierend auf Kontextabdeckung
- sourceReportTitles: Array der genutzten Berichtstitel (mind. 1, inkl. Design + Marketing)
- fullDraft: ausführlicher Markdown-Storefront-Entwurf (mind. 800 Zeichen)

JSON-Schema:
{
  "title": "string",
  "reportType": "shopify-report",
  "collectionName": "string",
  "collectionDescription": "string",
  "collectionSeoTitle": "string",
  "collectionSeoDescription": "string",
  "products": [{ "productName": "string", "productType": "string", "category": "string", "description": "string", "shortDescription": "string", "materials": "string", "tags": ["string"], "seoTitle": "string", "seoDescription": "string", "suggestedPrice": "string", "compareAtPrice": "string", "variants": [{ "optionName": "string", "optionValues": ["string"], "sku": "string", "price": "string" }], "inventoryRecommendation": "string" }],
  "collectionsToCreate": ["string"],
  "navigationRecommendations": ["string"],
  "homepageRecommendations": ["string"],
  "launchChecklist": ["string"],
  "storefrontWarnings": ["string"],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullDraft": "string (Markdown)"
}`;
}

/**
 * Shopify Agent — generate storefront drafts grounded in Brain intelligence.
 */
export async function runShopify(
  input: ShopifyRunInput,
): Promise<ShopifyRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[Shopify Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    briefPreview: input.brief.slice(0, 200),
  });

  const knowledge = await retrieveShopifyKnowledge({
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
          buildShopifySystemPrompt(
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

  console.info("[Shopify Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    designReports: knowledge.designReportCount,
    marketingReports: knowledge.marketingReportCount,
  });
  console.info("[Shopify Run] Raw OpenAI response:", raw);

  if (!raw) {
    throw new Error(dict.shopify.errors.noResponse);
  }

  let output;
  try {
    output = parseShopifyOutput(raw);
    console.info("[Shopify Run] Parsed and validated response", {
      title: output.title,
      productCount: output.products.length,
      collectionName: output.collectionName,
      confidence: output.confidence,
      sourceReports: output.sourceReportTitles,
    });
    console.info(
      "[Shopify Run] Validated output:",
      JSON.stringify(output, null, 2),
    );
  } catch (error) {
    if (error instanceof ShopifyParseError) {
      console.error("[Shopify Run] Parse/validation failed", error.toLogPayload());
      console.error(
        "[Shopify Run] Validation issues:",
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error("[Shopify Run] Detailed error:\n", error.toDetailedMessage());
      throw error;
    }
    throw error;
  }

  const saved = await saveShopifyToBrain({
    workspaceId: input.workspaceId,
    brief: input.brief,
    output,
  });

  // Simulate Shopify API draft creation for future integration hook
  await updateCollection(
    input.workspaceId,
    output.collectionName,
    output.collectionDescription,
  );
  for (const product of output.products.slice(0, 3)) {
    await createProductDraft(input.workspaceId, product);
  }

  console.info("[Shopify Run] Saved to Brain", {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    collectionName: output.collectionName,
    collectionDescription: output.collectionDescription,
    collectionSeoTitle: output.collectionSeoTitle,
    collectionSeoDescription: output.collectionSeoDescription,
    products: output.products,
    collectionsToCreate: output.collectionsToCreate,
    navigationRecommendations: output.navigationRecommendations,
    homepageRecommendations: output.homepageRecommendations,
    launchChecklist: output.launchChecklist,
    storefrontWarnings: output.storefrontWarnings,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { ShopifyKnowledgeError };
