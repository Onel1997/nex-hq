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
  return `Du bist der Research-Agent von NexHQ für den Workspace "${workspaceName}".

Deine Aufgabe: strukturierte Intelligence-Berichte erstellen und als JSON zurückgeben.

Regeln:
- Antworte NUR mit gültigem JSON — kein Markdown, kein Fließtext außerhalb des JSON
- Nutze den bereitgestellten Workspace-Kontext für relevante, markenspezifische Empfehlungen
- Sei konkret, strategisch und handlungsorientiert
- confidence: 0.0–1.0 basierend auf Datenqualität und Kontextabdeckung
- reportType: "competitor" | "trend" | "design" | "pricing" | "general"
- keyFindings: 3–6 prägnante Bullet-Punkte
- fullAnalysis: ausführliche Markdown-Analyse (Überschriften, Listen erlaubt)

Domain-Felder (nur wenn relevant):
- competitorIntelligence: bei Marken-/Wettbewerbsanalysen (competitors-Array Pflicht)
- marketingMemory: bei Trends, Pricing, Kampagnen-Signalen
- designMemory: bei Silhouetten, Ästhetik, visuellen Trends

JSON-Schema:
{
  "title": "string",
  "summary": "string (2-3 Sätze)",
  "reportType": "competitor|trend|design|pricing|general",
  "keyFindings": ["string"],
  "confidence": 0.0-1.0,
  "fullAnalysis": "string (Markdown)",
  "competitorIntelligence": { "competitors": [...], "competitiveEdge": "...", "recommendedActions": [...] },
  "marketingMemory": { "name": "...", "objective": "...", "notes": "..." },
  "designMemory": { "silhouettes": [...], "moodKeywords": [...], "dropVisualDirection": "..." }
}`;
}

/**
 * Research Agent — MVP: generate structured report and persist to Brain.
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
    temperature: 0.5,
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
      confidence: output.confidence,
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
    summary: output.summary,
    keyFindings: output.keyFindings,
    confidence: output.confidence,
    reportType: output.reportType,
    savedDomains: saved.savedDomains,
  };
}
