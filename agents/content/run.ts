import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { ContentParseError, parseContentOutput } from "./parse-output";
import {
  publishToInstagram,
  publishToKlaviyo,
  publishToShopify,
} from "./operations";
import {
  ContentKnowledgeError,
  retrieveContentKnowledge,
} from "./retrieve-context";
import { saveContentToBrain } from "./save";
import type { ContentRunInput, ContentRunResult } from "./types";

function buildContentSystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
  loadedTags: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  return `Du bist der Content-Agent von NexHQ — Copywriter und Storyteller für den Workspace "${workspaceName}" (Marke: Milaene).

## Deine Rolle
- Verwandle CEO-, Design-, Marketing- und Shopify-Daten in veröffentlichungsreife Inhalte
- Nutze AUSSCHLIESSLICH den bereitgestellten Wissensspeicher-Kontext und SHOPIFY KNOWLEDGE
- CEO-, Design-, Marketing-Berichte und der Live-Shopify-Katalog sind PRIMÄRE Quellen — jeder Text muss daraus abgeleitet werden
- Du darfst NIEMALS generische Marketingtexte erfinden — keine Platzhalter-Floskeln, keine erfundenen Produkte
- Produktinformationen (Name, Kollektion, Preis, Kategorie, Zielgruppe) kommen aus SHOPIFY KNOWLEDGE
- Outputs: Instagram Captions, TikTok Hooks, Product Storytelling, Launch Posts — basierend auf echten Produkten
- Halte die Milaene-Markenstimme konsistent: Urban Luxury Streetwear, selbstbewusst, knapp, premium
- Zitiere explizit Berichtstitel in sourceReportTitles
- Keine Mock-Produkte. Keine erfundenen Preise. Alles stammt aus Shopify.
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Denke wie ein Senior Copywriter für "${workspaceName}"

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences, KEIN Kommentar außerhalb des JSON
- Das Antwortformat ist json_object — alle Pflichtfelder müssen im Root-Objekt stehen
- Markdown ist NUR innerhalb des Feldes fullContent erlaubt

### Pflichtabschnitte
- title: prägnanter Titel des Content-Pakets
- reportType: immer "content-report"
- brandNarrative: ausführliche Marken-Narrative (mind. 120 Zeichen)
- landingPageCopy: { heroHeadline, heroSubheadline, brandStory, collectionIntroduction, cta }
- productCopy: Array (1–24) aus Shopify/Design-Produkten, jedes mit productName, shortDescription, longDescription, featureBullets[] (3–8), seoCopy
- emailSequence: { teaserEmail, revealEmail, countdownEmail, launchEmail } — je mind. 80–100 Zeichen
- socialContent: { instagramCaptions[10–20], tiktokHooks[10–20], storyIdeas[5–15], launchPosts[4–10] }
- smsCampaign: { teaserSms, countdownSms, launchSms } — je 20–160 Zeichen
- confidence: 0.0–1.0 basierend auf Kontextabdeckung
- sourceReportTitles: Array der genutzten Berichtstitel (mind. 1, inkl. CEO, Design, Marketing, Shopify)
- fullContent: ausführliches Markdown-Content-Paket (mind. 800 Zeichen)

JSON-Schema:
{
  "title": "string",
  "reportType": "content-report",
  "brandNarrative": "string",
  "landingPageCopy": { "heroHeadline": "string", "heroSubheadline": "string", "brandStory": "string", "collectionIntroduction": "string", "cta": "string" },
  "productCopy": [{ "productName": "string", "shortDescription": "string", "longDescription": "string", "featureBullets": ["string"], "seoCopy": "string" }],
  "emailSequence": { "teaserEmail": "string", "revealEmail": "string", "countdownEmail": "string", "launchEmail": "string" },
  "socialContent": { "instagramCaptions": ["string x10-20"], "tiktokHooks": ["string x10-20"], "storyIdeas": ["string x5-15"], "launchPosts": ["string x4-10"] },
  "smsCampaign": { "teaserSms": "string", "countdownSms": "string", "launchSms": "string" },
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["string"],
  "fullContent": "string (Markdown)"
}`;
}

/**
 * Content Agent — generate publish-ready copy grounded in Brain intelligence.
 */
export async function runContent(
  input: ContentRunInput,
): Promise<ContentRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[Content Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    briefPreview: input.brief.slice(0, 200),
  });

  const knowledge = await retrieveContentKnowledge({
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
          buildContentSystemPrompt(
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

  console.info("[Content Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    primaryReportCounts: knowledge.primaryReportCounts,
  });
  console.info("[Content Run] Raw OpenAI response:", raw);

  if (!raw) {
    throw new Error(dict.content.errors.noResponse);
  }

  let output;
  try {
    output = parseContentOutput(raw);
    console.info("[Content Run] Parsed and validated response", {
      title: output.title,
      productCount: output.productCopy.length,
      instagramCount: output.socialContent.instagramCaptions.length,
      confidence: output.confidence,
      sourceReports: output.sourceReportTitles,
    });
    console.info(
      "[Content Run] Validated output:",
      JSON.stringify(output, null, 2),
    );
  } catch (error) {
    if (error instanceof ContentParseError) {
      console.error("[Content Run] Parse/validation failed", error.toLogPayload());
      console.error(
        "[Content Run] Validation issues:",
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error("[Content Run] Detailed error:\n", error.toDetailedMessage());
      throw error;
    }
    throw error;
  }

  const saved = await saveContentToBrain({
    workspaceId: input.workspaceId,
    brief: input.brief,
    output,
    originTaskId: input.originTaskId,
  });

  await publishToShopify(input.workspaceId, output);
  await publishToKlaviyo(input.workspaceId, output);
  await publishToInstagram(input.workspaceId, output);

  console.info("[Content Run] Saved to Brain", {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    brandNarrative: output.brandNarrative,
    landingPageCopy: output.landingPageCopy,
    productCopy: output.productCopy,
    emailSequence: output.emailSequence,
    socialContent: output.socialContent,
    smsCampaign: output.smsCampaign,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { ContentKnowledgeError };
