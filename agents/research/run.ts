import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { generateDesignBrief } from "@/services/designBriefEngine";
import { parseResearchOutput, ResearchParseError } from "./parse-output";
import { retrieveResearchKnowledge } from "./retrieve-context";
import { saveResearchToBrain } from "./save";
import type { ResearchRunInput, ResearchRunResult } from "./types";

const dict = getDictionary(DEFAULT_LOCALE);

function buildResearchSystemPrompt(workspaceName: string): string {
  return `Du bist der Research-Agent von NexHQ — das strategische Gehirn der Marke Milaene im Workspace "${workspaceName}".

Deine Aufgabe: echte Business Intelligence sammeln, analysieren und konkrete Entscheidungen ableiten.

Du erhältst LIVE-DATEN aus Shopify, MarketPrint POD, Verkaufsdaten und Intelligence Engines.
Jede Analyse MUSS gegen die Milaene Brand DNA geprüft werden.

## Produkt-Regeln (PFLICHT)
- Empfehle AUSSCHLIESSLICH Produkte, Farben, Größen und Materialien aus dem Abschnitt VERFÜGBARE PRODUKTE
- Erfinde KEINE Produkte (z.B. keine Purple Hoodies wenn nicht im Katalog)
- Erfinde KEINE Farben (z.B. kein Earth Brown wenn nicht verfügbar)
- Priorisiere Bestseller und verfügbare Varianten
- Berücksichtige Printflächen und Materialien aus dem Katalog

## Entscheidungsstandard
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Nutze die LIVE-DATEN als primäre Quelle — keine generischen Aussagen
- Nenne nur konkrete Produkte aus dem VERFÜGBARE PRODUKTE Katalog
- Leite Chancen aus echten Bestsellern, Schwächen und Kategorie-Lücken ab
- Jeder Report endet mit umsetzbaren Empfehlungen für Design Studio

## Ausgabeformat
- Antworte NUR mit gültigem JSON

### Vollständiger Research-Report (Standard)
- title, executiveSummary, reportType, keyFindings, opportunities, risks, recommendations, confidence, fullAnalysis

### Design-Ideen (bei Design-Anfragen)
Wenn die Anfrage konkrete Design-Ideen verlangt, darf stattdessen geliefert werden:
{
  "title": "Kollektion / Drop Name",
  "designs": ["Design-Idee 1", "Design-Idee 2", ...],
  "products": ["echte Katalogprodukte"],
  "colors": ["verfügbare Farben"]
}
- designs[] ist Pflicht (1–12 Einträge)
- Nur Produkte/Farben aus VERFÜGBARE PRODUKTE verwenden

## Pflichtabschnitte (nur Vollständiger Research-Report)
- title: kurzer strategischer Report-Titel
- executiveSummary: 4–6 Sätze mit strategischer Kernaussage
- keyFindings: 5–8 detaillierte Erkenntnisse
- opportunities: 3–6 konkrete Chancen für Milaene
- risks: 3–5 Risiken
- recommendations: 4–8 priorisierte Empfehlungen
- fullAnalysis: Markdown-Analyse (mind. 1.200 Wörter)

## Typ-spezifische Abschnitte
### reportType = "competitor" → competitorReport (PFLICHT)
### reportType = "trend" → trendReport (PFLICHT, designImplications Pflicht)

## Design Brief (optional im JSON — wird serverseitig ergänzt)
designBrief: { collectionIdea, productSuggestions, targetAudience, colorPalette, styleDirection, silhouettes, trendScore, competitorScore, confidence, rationale }

JSON-Schema siehe System-Kontext.`;
}

/**
 * Research Agent — generate structured strategy report with live intelligence
 * and persist to Brain including Design Studio handoff brief.
 */
export async function runResearch(
  input: ResearchRunInput,
): Promise<ResearchRunResult> {
  console.info("[Research Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    requestPreview: input.request.slice(0, 200),
  });

  const knowledge = await retrieveResearchKnowledge({
    workspaceId: input.workspaceId,
    request: input.request,
  });

  console.info("[Research Run] Intelligence loaded", {
    commerceConnected: knowledge.intelligence.commerceConnected,
    bestsellers: knowledge.intelligence.products.bestsellers.length,
    opportunities: knowledge.intelligence.opportunities.length,
    priorReports: knowledge.intelligenceReportCount,
    tokenEstimate: knowledge.brainContext.tokenEstimate,
  });

  const { getOpenAIClient } = await import("@/lib/openai/client");
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
          buildResearchSystemPrompt(input.workspaceName) +
          "\n\n" +
          knowledge.brainContext.promptContext,
      },
      {
        role: "user",
        content: input.request,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  console.info("[Research Run] OpenAI response received", {
    finishReason: completion.choices[0]?.finish_reason,
    rawLength: raw?.length ?? 0,
  });

  if (!raw) {
    throw new Error(dict.research.errors.noResponse);
  }

  let parsed;
  console.log("[Research] Before parse");
  try {
    parsed = parseResearchOutput(raw);
    console.log("[Research] After parse", { kind: parsed.kind });
  } catch (error) {
    console.log("[Research] Parse threw");
    if (error instanceof ResearchParseError) {
      console.error("[Research Run] Parse failed", error.toLogPayload());
      throw error;
    }
    throw error;
  }

  const reportId = crypto.randomUUID();
  console.log("[Research] Before design brief");
  const designBrief = generateDesignBrief({
    intelligence: knowledge.intelligence,
    report: parsed.output,
    sourceReportId: reportId,
  });
  console.log("[Research] After design brief");

  parsed.output.designBrief = designBrief;

  console.log("[Research] Before save");
  let saved;
  try {
    saved = await saveResearchToBrain({
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      request: input.request,
      output: parsed.output,
      originTaskId: input.originTaskId,
      reportId,
    });
    console.log("[Research] After save");
  } catch (error) {
    console.error("[Research] Save failed", error);
    throw error;
  }

  console.info("[Research Run] Saved to Brain", {
    reportId: saved.reportId,
    savedDomains: saved.savedDomains,
    designBrief: designBrief.collectionIdea,
    outputKind: parsed.kind,
  });

  if (parsed.kind === "design") {
    return {
      reportId: saved.reportId,
      reportRecordId: saved.reportRecordId,
      title: parsed.output.title,
      outputKind: "design",
      designs: parsed.output.designs,
      products: parsed.output.products,
      colors: parsed.output.colors,
      materials: parsed.output.materials,
      printAreas: parsed.output.printAreas,
      rationale: parsed.output.rationale,
      confidence: parsed.output.confidence,
      savedDomains: saved.savedDomains,
      designBrief,
    };
  }

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: parsed.output.title,
    outputKind: "research",
    executiveSummary: parsed.output.executiveSummary,
    keyFindings: parsed.output.keyFindings,
    opportunities: parsed.output.opportunities,
    risks: parsed.output.risks,
    recommendations: parsed.output.recommendations,
    confidence: parsed.output.confidence,
    reportType: parsed.output.reportType,
    savedDomains: saved.savedDomains,
    designBrief,
  };
}
