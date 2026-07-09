import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { logCeoFinalReportEvent } from "@/lib/orchestration/final-report-events";
import type {
  GoalSynthesisContext,
  SynthesisReportSnapshot,
} from "@/lib/reports/goal-synthesis";
import { getTaskByTaskId, updateTask } from "@/lib/tasks/task-service";
import { CeoFinalParseError, parseCeoFinalOutput } from "./parse-final-report";
import { saveCeoFinalReportToBrain } from "./save-final-report";
import type { CeoFinalReportInput, CeoFinalReportResult } from "./final-report-types";

const ORCHESTRATOR_ACTOR = { type: "agent" as const, id: "ceo" };

function formatReportBlock(
  label: string,
  reports: SynthesisReportSnapshot[],
): string {
  if (reports.length === 0) {
    return `## ${label}\n(Keine Berichte)`;
  }

  return reports
    .map(
      (report, index) => `## ${label} ${index + 1}: ${report.title}
Agent: ${report.agentId}
Zusammenfassung: ${report.executiveSummary}
Key Findings: ${report.keyFindings.join(" | ")}
Chancen: ${report.opportunities.join(" | ")}
Risiken: ${report.risks.join(" | ")}
Empfehlungen: ${report.recommendations.join(" | ")}`,
    )
    .join("\n\n");
}

function buildFinalReportSystemPrompt(workspaceName: string): string {
  return `Du bist der CEO-Agent von NexHQ — Executive Orchestrator für "${workspaceName}".

## Deine Rolle (Final Synthesis)
- Synthetisiere freigegebene Research-, Design- und Marketing-Berichte zu einem finalen Executive Report
- Der Gründer hat ein strategisches Ziel gesetzt — dein Report ist die operative Entscheidungsgrundlage
- Jede Aussage muss auf den bereitgestellten freigegebenen Berichten basieren
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Sei entscheidungsfreudig — der Gründer braucht ein klares Urteil, keine vagen Zusammenfassungen

## Ausgabeformat
Antworte NUR mit gültigem JSON.

{
  "title": "Titel des Executive Final Reports",
  "reportType": "ceo-final-report",
  "executiveSummary": "Umfassende Executive Summary (mind. 120 Zeichen)",
  "keyFindings": ["..."],
  "opportunities": ["..."],
  "risks": ["..."],
  "recommendedActions": [{ "action": "...", "priority": "high|medium|low", "rationale": "..." }],
  "launchStrategy": "Konkrete Launch-Strategie (mind. 80 Zeichen)",
  "nextMilestones": ["..."],
  "ceoVerdict": "Klares Go/No-Go oder bedingtes Go mit Begründung (mind. 60 Zeichen)",
  "confidence": 0.0-1.0,
  "fullBriefing": "Ausführliches Markdown-Briefing (mind. 800 Wörter)"
}`;
}

function buildFinalReportUserPrompt(context: {
  founderGoal: string;
  parentGoalTaskId: string;
  researchReports: SynthesisReportSnapshot[];
  designReports: SynthesisReportSnapshot[];
  marketingReports: SynthesisReportSnapshot[];
}): string {
  return `# Gründer-Ziel
${context.founderGoal}

# Parent Goal Task ID
${context.parentGoalTaskId}

# Freigegebene Research-Berichte
${formatReportBlock("Research", context.researchReports)}

# Freigegebene Design-Berichte
${formatReportBlock("Design", context.designReports)}

# Freigegebene Marketing-Berichte
${formatReportBlock("Marketing", context.marketingReports)}

Synthetisiere diese freigegebenen Berichte zu einem finalen Executive Report für den Gründer.`;
}

/**
 * CEO Final Report — synthesize approved specialist reports into executive decision.
 */
export async function runCeoFinalReport(
  input: CeoFinalReportInput,
): Promise<CeoFinalReportResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  const completionScore = Math.round(
    ((input.researchReports.length > 0 ? 1 : 0) +
      (input.designReports.length > 0 ? 1 : 0) +
      (input.marketingReports.length > 0 ? 1 : 0)) /
      3 *
      100,
  );

  await logCeoFinalReportEvent({
    eventType: "ceo.final_report.started",
    payload: {
      parentGoalTaskId: input.parentGoalTaskId,
      founderGoal: input.founderGoal,
      researchCount: input.researchReports.length,
      designCount: input.designReports.length,
      marketingCount: input.marketingReports.length,
    },
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 12000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildFinalReportSystemPrompt(input.workspaceName),
      },
      {
        role: "user",
        content: buildFinalReportUserPrompt({
          founderGoal: input.founderGoal,
          parentGoalTaskId: input.parentGoalTaskId,
          researchReports: input.researchReports,
          designReports: input.designReports,
          marketingReports: input.marketingReports,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error(dict.ceo.errors.noResponse);
  }

  let output;
  try {
    output = parseCeoFinalOutput(raw);
  } catch (error) {
    if (error instanceof CeoFinalParseError) throw error;
    throw error;
  }

  const saved = await saveCeoFinalReportToBrain({
    workspaceId: input.workspaceId,
    output,
    parentGoalTaskId: input.parentGoalTaskId,
    founderGoal: input.founderGoal,
    completionScore,
    childTaskIds: input.childTaskIds,
    researchReports: input.researchReports,
    designReports: input.designReports,
    marketingReports: input.marketingReports,
  });

  await logCeoFinalReportEvent({
    recordId: saved.reportRecordId,
    eventType: "ceo.final_report.generated",
    payload: {
      reportId: saved.reportId,
      parentGoalTaskId: input.parentGoalTaskId,
      completionScore,
    },
  });

  const parentTask = await getTaskByTaskId(input.parentGoalTaskId);
  if (parentTask && parentTask.status === "in_progress") {
    await updateTask(
      parentTask.brainRecordId,
      {
        status: "completed",
        payload: {
          ...parentTask.payload,
          linkedFinalReportId: saved.reportId,
          linkedFinalReportRecordId: saved.reportRecordId,
        },
      },
      ORCHESTRATOR_ACTOR,
    );
  }

  await logCeoFinalReportEvent({
    recordId: saved.reportRecordId,
    eventType: "ceo.final_report.completed",
    payload: {
      reportId: saved.reportId,
      parentGoalTaskId: input.parentGoalTaskId,
      parentTaskCompleted: true,
    },
  });

  console.info("[CEO Final Report] Synthesis complete", {
    reportId: saved.reportId,
    parentGoalTaskId: input.parentGoalTaskId,
  });

  return {
    reportId: saved.reportId,
    reportRecordId: saved.reportRecordId,
    title: output.title,
    executiveSummary: output.executiveSummary,
    completionScore,
    parentGoalTaskId: input.parentGoalTaskId,
  };
}

export { CeoFinalParseError };
