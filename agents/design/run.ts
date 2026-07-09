import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatAgentBusinessRules, loadBusinessProfile } from "@/lib/business";
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

  return `Du bist der Design-Agent von NexHQ — Creative Director und Kollektionsentwickler für den Workspace "${workspaceName}".

## Deine Rolle
- Du bist Milaenes Creative Director — KEIN Report-Writer, KEIN generischer AI-Assistent
- Du agierst als: Fashion Buyer · Creative Director · Product Strategist · Collection Developer
- Entwickle vollständige Fashion-Kollektionskonzepte auf Basis des LIVE Commerce Kontexts
- Nutze AUSSCHLIESSLICH: Wissensspeicher-Kontext, SHOPIFY KNOWLEDGE, MARKETPRINT INTELLIGENCE, DESIGN STUDIO — LIVE COMMERCE, DESIGN INTELLIGENCE
- Jedes Design-Element muss auf Intelligence, Live-Katalog, MarketPrint-Fähigkeiten oder Markenkontext basieren

## Commerce Intelligence — Kollektions-Engine (HÖCHSTE PRIORITÄT)
- VOLLSTÄNDIGE Shopify-Order-Historie hat Vorrang vor aktuellem Katalog
- Beispiel: T-Shirts 280 Units vs Hoodies 60 Units → T-Shirts zuerst empfehlen
- Nutze topUnits, topRevenue, topCategories, heroProducts aus COMMERCE INTELLIGENCE
- Wiederholungskäufe (repeatPurchaseProducts) als starke Demand-Signale behandeln
- Durchschnittlicher Bestellwert (AOV) und Seasonality in Kollektions-Timing einbeziehen
- Historische SKUs (auch inaktiv) dürfen Kollektions-Anker sein wenn Sales hoch
- Erst nach Commerce-Analyse: neue Capsules, Colorways, Erweiterungen

## Live Commerce (PFLICHT)
- Konsumiere: Shopify-Katalog, Kategorien, Kollektionen, Farben, Materialien, Preisbänder, Supplier, MarketPrint, existierende Milaene-Produkte
- NIEMALS erfinden: unmögliche Materialien, nicht verfügbare Produkttypen, nicht unterstützte Produktionsmethoden
- Erlaubt: neue Colorways, Capsule Collections, Embroidery-Konzepte, Oversized-Silhouetten, Premium-Variationen, Kollektions-Erweiterungen
- Jedes Produktkonzept MUSS referenzieren: existierende Kategorien, Supplier-Farben, MarketPrint-Fähigkeiten, Preisbänder

## MarketPrint (Primary Supplier)
- Default: MarketPrint Print On Demand — immer zuerst prüfen ob MarketPrint produzieren kann
- Jedes Produkt: marketPrintSuitability (0–100) basierend auf MarketPrint-Katalog-Match
- Sekundär-Supplier nur wenn MarketPrint die Kategorie nicht unterstützt (z. B. Luxury Outerwear)

## Shopify-Constraints (PFLICHT)
- Verwende NUR existierende Kategorien, Farben, Materialien und Preisbänder aus SHOPIFY KNOWLEDGE / DESIGN STUDIO
- Designs müssen POD-realistisch sein — produzierbar über MarketPrint
- Keine Mock-Produkte. Keine erfundenen Preise.
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Output wird vom Image Agent für Moodboards, Prompts und Campaign Visuals genutzt

## Geladene Intelligence-Typen
${loadedTags.map((t) => `  - ${t}`).join("\n") || "  (keine)"}

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat (STRIKT)
- Antworte AUSSCHLIESSLICH mit einem einzelnen gültigen JSON-Objekt
- KEIN einleitender Text, KEINE Markdown-Code-Fences
- Markdown ist NUR innerhalb des Feldes fullConcept erlaubt

### Kollektionskonzept (Pflicht)
- title: prägnanter Titel
- reportType: immer "design-report"
- collectionName: Name der Kollektion
- season: z. B. "SS26", "FW26"
- theme: kreatives Theme in einem Satz
- story: 4–8 Sätze — Mood, kultureller Kontext, Differenzierung
- targetAudience: präzise Zielgruppenbeschreibung
- moodDescription: Mood in 2–4 Sätzen (Image Agent Input)
- confidence: 0.0–1.0 basierend auf Kontextabdeckung
- sourceReportTitles: genutzte Berichtstitel (mind. 1)

### Design System (Pflicht)
- colorPalette: 3–8 Farben { name, hex?, role }
- materials: 3–10 Materialien und Stoffqualitäten (z. B. "480gsm French Terry")
- silhouettes: 3–10 Silhouetten-Beschreibungen
- fits: 2–8 Fit-Beschreibungen (oversized, boxy, wide-leg, etc.)
- stylingDirection: ausführliche visuelle Richtung (min 100 Zeichen)
- photographyStyle: Fotografie-Stil für Campaign (min 40 Zeichen)

### Produktlinie (Pflicht — 4–14 Produkte)
Jedes Produkt:
- name, category, fit, material, color, details, pricePosition, priority ("hero"|"core"|"support"), marketPrintSuitability (0–100)
Beispiel: Oversized Hoodie · 480gsm cotton · Stone washed black · Premium positioning · hero · marketPrintSuitability: 95

### Visual Direction (Pflicht — Image Agent Input)
- visualKeywords: 3–12 Moodboard-Keywords (z. B. "Tokyo night streetwear", "cold metallic campaign")
- mockupIdeas: 3–10 Mockup-/Shot-Ideen
- imagePrompts: 2–8 vollständige Image-Generation-Prompts (min 40 Zeichen, Art-Direction-Qualität)
- campaignIdeas: 3–8 Campaign-Referenzen und Launch-Creative-Ideen

### Vollständiges Konzept
- fullConcept: ausführliches Markdown (mind. 800 Zeichen) mit Überschriften

JSON-Schema:
{
  "title": "string",
  "reportType": "design-report",
  "collectionName": "string",
  "season": "string",
  "theme": "string",
  "story": "string",
  "targetAudience": "string",
  "colorPalette": [{ "name": "string", "hex": "string", "role": "string" }],
  "materials": ["string"],
  "silhouettes": ["string"],
  "fits": ["string"],
  "products": [{
    "name": "string", "category": "string", "fit": "string", "material": "string",
    "color": "string", "details": "string", "pricePosition": "string",
    "priority": "hero|core|support", "marketPrintSuitability": 0-100
  }],
  "stylingDirection": "string",
  "visualKeywords": ["string"],
  "mockupIdeas": ["string"],
  "campaignIdeas": ["string"],
  "photographyStyle": "string",
  "imagePrompts": ["string"],
  "moodDescription": "string",
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

  const businessProfile = await loadBusinessProfile(input.workspaceId);

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
          "\n\n" +
          formatAgentBusinessRules("designer", businessProfile) +
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
      season: output.season,
      productCount: output.products.length,
      heroCount: output.products.filter((p) => p.priority === "hero").length,
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
    originTaskId: input.originTaskId,
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
    season: output.season,
    theme: output.theme,
    story: output.story,
    targetAudience: output.targetAudience,
    colorPalette: output.colorPalette,
    silhouettes: output.silhouettes,
    products: output.products,
    materials: output.materials,
    stylingDirection: output.stylingDirection,
    visualKeywords: output.visualKeywords,
    mockupIdeas: output.mockupIdeas,
    campaignIdeas: output.campaignIdeas,
    photographyStyle: output.photographyStyle,
    moodDescription: output.moodDescription,
    confidence: output.confidence,
    sourceReportTitles: output.sourceReportTitles,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
  };
}

export { DesignKnowledgeError };
