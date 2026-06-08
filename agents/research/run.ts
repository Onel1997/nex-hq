import { getBrainContextAssembler } from "@/brain/context/assembler-impl";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { parseResearchOutput, ResearchParseError } from "./parse-output";
import { saveResearchToBrain } from "./save";
import type { ResearchRunInput, ResearchRunResult } from "./types";

const RESEARCH_CONTEXT_DOMAINS = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "competitor_intelligence",
] as const;

function buildResearchSystemPrompt(workspaceName: string): string {
  return `Du bist der Research-Agent von NexHQ — ein Junior-Strategieanalyst für den Workspace "${workspaceName}".

Deine Aufgabe: tiefgehende, markenspezifische Intelligence-Berichte erstellen und als JSON zurückgeben.

## Qualitätsstandard
- Schreibe AUSSCHLIESSLICH auf Deutsch — keine englischen Formulierungen
- Denke wie ein Strategieanalyst, nicht wie ein ChatGPT-Zusammenfasser
- Jeder Abschnitt muss konkret, begründet und handlungsorientiert sein
- Nutze den Workspace-Kontext für alle Empfehlungen und Chancen für "${workspaceName}"
- Verwende bei Chancen/Relevanz-Feldern den Markennamen "${workspaceName}" (nicht generisch "die Marke")
- Liefere 5–10× mehr Tiefe als eine oberflächliche Zusammenfassung
- Nenne konkrete Produkte, Kanäle, Preispunkte, Zielgruppen und Wettbewerber wo möglich
- Begründe strategische Aussagen mit Kontext aus dem Workspace oder marktüblicher Logik

## Ausgabeformat
- Antworte NUR mit gültigem JSON — kein Markdown außerhalb von fullAnalysis
- confidence: 0.0–1.0 basierend auf Datenqualität und Kontextabdeckung
- reportType: "competitor" | "trend" | "design" | "pricing" | "audience"

## Pflichtabschnitte (immer)
- executiveSummary: 4–6 Sätze, strategische Kernaussage mit Implikation für "${workspaceName}"
- keyFindings: 5–8 detaillierte Erkenntnisse (je mind. 1 vollständiger Satz mit Kontext)
- opportunities: 3–6 konkrete Chancen für "${workspaceName}"
- risks: 3–5 Risiken mit strategischer Einordnung
- recommendations: 4–8 priorisierte, umsetzbare Empfehlungen
- fullAnalysis: ausführliche Markdown-Analyse (mind. 1.200 Wörter) mit Überschriften, Unterpunkten und Querverweisen zu den strukturierten Abschnitten

## Typ-spezifische Abschnitte
### reportType = "competitor" → competitorReport (PFLICHT)
- positioning: Detaillierte Positionierung der analysierten Marke(n)
- targetAudience: Zielgruppe, Demografie, Psychografie, Kaufverhalten
- pricing: Preisarchitektur, Preispunkte, Premium-/Value-Signale
- productCategories: Kernkategorien und Sortimentslogik
- marketingStrategy: Kanäle, Botschaften, Launch-Rhythmus, Paid/Organic-Mix
- communityStrategy: Community-Aufbau, UGC, Events, Loyalty-Mechaniken
- strengths: Mind. 3 substantielle Stärken
- weaknesses: Mind. 3 substantielle Schwächen
- brandOpportunities: Mind. 3 konkrete Chancen für "${workspaceName}" gegenüber dem Wettbewerber

### reportType = "trend" → trendReport (PFLICHT)
- trendDescription: Was der Trend ist, wo er herkommt, wer ihn treibt
- whyItMatters: Strategische Bedeutung für Streetwear/Fashion
- adoptionLevel: "nascent" | "emerging" | "mainstream" | "declining"
- relevanceForBrand: Konkrete Relevanz für "${workspaceName}"
- designImplications: Mind. 3 Design-Umsetzungen
- contentImplications: Mind. 3 Content-/Marketing-Umsetzungen

## Optionale Brain-Domänen (nur wenn relevant)
- competitorIntelligence: bei Wettbewerbsanalysen (competitors-Array Pflicht)
- marketingMemory: bei Trends, Pricing, Audience, Kampagnen-Signalen
- designMemory: bei Silhouetten, Ästhetik, visuellen Trends

JSON-Schema:
{
  "title": "string",
  "executiveSummary": "string",
  "reportType": "competitor|trend|design|pricing|audience",
  "keyFindings": ["string"],
  "opportunities": ["string"],
  "risks": ["string"],
  "recommendations": ["string"],
  "confidence": 0.0-1.0,
  "fullAnalysis": "string (Markdown, sehr ausführlich)",
  "competitorReport": {
    "positioning": "string",
    "targetAudience": "string",
    "pricing": "string",
    "productCategories": ["string"],
    "marketingStrategy": "string",
    "communityStrategy": "string",
    "strengths": ["string"],
    "weaknesses": ["string"],
    "brandOpportunities": ["string"]
  },
  "trendReport": {
    "trendDescription": "string",
    "whyItMatters": "string",
    "adoptionLevel": "nascent|emerging|mainstream|declining",
    "relevanceForBrand": "string",
    "designImplications": ["string"],
    "contentImplications": ["string"]
  },
  "competitorIntelligence": { "competitors": [...], "competitiveEdge": "...", "recommendedActions": [...] },
  "marketingMemory": { "name": "...", "objective": "...", "notes": "..." },
  "designMemory": { "silhouettes": [...], "moodKeywords": [...], "dropVisualDirection": "..." }
}`;
}

/**
 * Research Agent — generate structured strategy report and persist to Brain.
 */
export async function runResearch(
  input: ResearchRunInput,
): Promise<ResearchRunResult> {
  const dict = getDictionary(DEFAULT_LOCALE);
  const assembler = getBrainContextAssembler();

  console.info("[Research Run] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    requestPreview: input.request.slice(0, 200),
  });

  const brainContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "research",
    domains: [...RESEARCH_CONTEXT_DOMAINS],
    locale: DEFAULT_LOCALE,
  });

  console.info("[Research Run] Brain context assembled", {
    sourceRecordCount: brainContext.sourceRecordIds.length,
    tokenEstimate: brainContext.tokenEstimate,
    domains: brainContext.slices.map((s) => s.domain),
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
          buildResearchSystemPrompt(input.workspaceName) +
          "\n\n## Workspace-Kontext\n\n" +
          brainContext.promptContext,
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
  console.info("[Research Run] Raw OpenAI response:", raw);

  if (!raw) {
    throw new Error(dict.research.errors.noResponse);
  }

  let output;
  try {
    output = parseResearchOutput(raw);
    console.info("[Research Run] Parsed and validated response", {
      title: output.title,
      reportType: output.reportType,
      keyFindingsCount: output.keyFindings.length,
      recommendationsCount: output.recommendations.length,
      confidence: output.confidence,
      hasCompetitorReport: Boolean(output.competitorReport),
      hasTrendReport: Boolean(output.trendReport),
      hasCompetitorIntelligence: Boolean(output.competitorIntelligence),
      hasMarketingMemory: Boolean(output.marketingMemory),
      hasDesignMemory: Boolean(output.designMemory),
    });
    console.info(
      "[Research Run] Validated output:",
      JSON.stringify(output, null, 2),
    );
  } catch (error) {
    if (error instanceof ResearchParseError) {
      console.error(
        "[Research Run] Parse/validation failed",
        error.toLogPayload(),
      );
      console.error("[Research Run] Detailed error:\n", error.toDetailedMessage());
      throw error;
    }

    console.error("[Research Run] Unexpected parse error", error);
    throw error;
  }

  const saved = await saveResearchToBrain({
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    request: input.request,
    output,
  });

  console.info("[Research Run] Saved to Brain", {
    reportId: saved.reportId,
    savedDomains: saved.savedDomains,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    executiveSummary: output.executiveSummary,
    keyFindings: output.keyFindings,
    opportunities: output.opportunities,
    risks: output.risks,
    recommendations: output.recommendations,
    confidence: output.confidence,
    reportType: output.reportType,
    savedDomains: saved.savedDomains,
  };
}
