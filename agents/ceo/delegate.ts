import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getOpenAIClient } from "@/lib/openai/client";
import { getAutoExecutionConfig } from "@/lib/orchestration/auto-execution";
import { executeAssignedTasks } from "@/lib/orchestration/task-executor";
import { ceoAssignTask, ceoCreateTask } from "@/lib/tasks/ceo-service";
import type { TaskListItem } from "@/tasks/types";
import {
  CeoDelegationParseError,
  parseDelegationOutput,
} from "./parse-delegation";
import { CeoKnowledgeError, retrieveCeoKnowledge } from "./retrieve-context";
import type {
  CeoDelegationInput,
  CeoDelegationResult,
  CeoDelegatedTaskResult,
  CeoDelegationExecutionResult,
} from "./delegation-types";

const SPECIALIST_LABELS: Record<string, string> = {
  research: "Research",
  designer: "Design",
  content: "Content",
  image: "Image",
  marketing: "Marketing",
  shopify: "Shopify",
};

function buildDelegationSystemPrompt(
  workspaceName: string,
  availableReportTitles: string[],
): string {
  const reportList =
    availableReportTitles.length > 0
      ? availableReportTitles.map((t) => `  - ${t}`).join("\n")
      : "  (keine Berichte im Kontext)";

  const assigneeList = Object.entries(SPECIALIST_LABELS)
    .map(([id, label]) => `  - ${id}: ${label}`)
    .join("\n");

  return `Du bist der CEO-Agent von NexHQ — Master Orchestrator für den Workspace "${workspaceName}".

## Deine Rolle (Delegationsmodus)
- Der Gründer gibt dir ein strategisches Ziel (z. B. „Create a summer streetwear drop for Milaene")
- Du zerlegst das Ziel in ein klares Objective, Meilensteine und einen ausführbaren Task-Plan
- Jeder Task wird einem Spezialisten-Agenten zugewiesen — du führst KEINE Agenten selbst aus
- Basis jeder Entscheidung ist der bereitgestellte Wissensspeicher-Kontext
- Wenn der Kontext eine Information nicht enthält, sage das in der rationale — erfinde keine Marktdaten
- Schreibe AUSSCHLIESSLICH auf Deutsch

## Verfügbare Spezialisten (assigneeAgentId)
${assigneeList}

## Task-Zerlegung — Beispiel für einen Streetwear-Drop
Research:
- Trend Analysis → research
- Competitor Scan → research

Design:
- Collection Concept → designer
- Product Direction → designer

Marketing:
- Launch Strategy → marketing

Content / Image / Shopify je nach Bedarf.

## Verfügbare Berichte im Kontext
${reportList}

## Ausgabeformat
Antworte NUR mit gültigem JSON.

{
  "title": "Kurzer Titel des Delegationsplans",
  "objective": "Klares, messbares Ziel (mind. 40 Zeichen)",
  "milestones": ["Meilenstein 1", "Meilenstein 2", ...],
  "taskPlan": [
    {
      "title": "Task-Titel",
      "description": "Konkrete Arbeitsanweisung für den Spezialisten (mind. 20 Zeichen)",
      "assigneeAgentId": "research|designer|content|image|marketing|shopify",
      "priority": "high|medium|low",
      "domain": "research|design|marketing|content|image|shopify"
    }
  ],
  "confidence": 0.0-1.0,
  "sourceReportTitles": ["Berichtstitel aus dem Kontext"],
  "rationale": "Kurze Begründung der Zerlegung und Priorisierung"
}

Regeln:
- taskPlan: mind. 3, max. 20 Tasks
- milestones: mind. 2, max. 8
- Jeder Task braucht genau einen assigneeAgentId aus der Liste oben
- Verteile Tasks sinnvoll — nicht alles an einen Agenten
- Priorisiere kritische Pfad-Tasks als "high"`;
}

/**
 * CEO Delegation — decompose a founder goal into tasks, assign specialists,
 * and optionally auto-execute eligible agents when AUTO_EXECUTION_ENABLED is set.
 */
export async function runCeoDelegation(
  input: CeoDelegationInput,
): Promise<CeoDelegationResult> {
  const dict = getDictionary(DEFAULT_LOCALE);

  console.info("[CEO Delegate] Starting", {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    goalPreview: input.goal.slice(0, 200),
  });

  const knowledge = await retrieveCeoKnowledge({
    workspaceId: input.workspaceId,
    question: input.goal,
    locale: DEFAULT_LOCALE,
  });

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 8000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          buildDelegationSystemPrompt(
            input.workspaceName,
            knowledge.reportTitles,
          ) +
          "\n\n## Wissensspeicher-Kontext\n\n" +
          knowledge.brainContext.promptContext,
      },
      {
        role: "user",
        content: input.goal,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error(dict.ceo.errors.noResponse);
  }

  let output;
  try {
    output = parseDelegationOutput(raw);
    console.info("[CEO Delegate] Parsed delegation plan", {
      title: output.title,
      milestoneCount: output.milestones.length,
      taskCount: output.taskPlan.length,
      confidence: output.confidence,
    });
  } catch (error) {
    if (error instanceof CeoDelegationParseError) {
      console.error("[CEO Delegate] Parse failed", error.toLogPayload());
      throw error;
    }
    throw error;
  }

  const { task: parentTask } = await ceoCreateTask({
    title: output.title,
    description: output.objective,
    priority: "high",
    status: "in_progress",
    payload: {
      kind: "ceo-goal",
      goal: input.goal,
      milestones: output.milestones,
      confidence: output.confidence,
      rationale: output.rationale,
      sourceReportTitles: output.sourceReportTitles,
    },
  });

  console.info("[CEO Delegate] Created parent goal task", {
    parentTaskId: parentTask.id,
  });

  const createdTasks: CeoDelegatedTaskResult[] = [];
  const assignedTaskItems: TaskListItem[] = [];

  for (const planned of output.taskPlan) {
    const { task: created } = await ceoCreateTask({
      title: planned.title,
      description: planned.description,
      priority: planned.priority,
      parentTaskId: parentTask.id,
      payload: {
        domain: planned.domain,
        goalRef: parentTask.id,
        specialistPrompt: planned.description,
      },
    });

    const { task: assigned } = await ceoAssignTask(
      created.brainRecordId,
      planned.assigneeAgentId,
    );

    assignedTaskItems.push(assigned);

    createdTasks.push({
      id: assigned.id,
      brainRecordId: assigned.brainRecordId,
      title: assigned.title,
      description: assigned.description,
      status: assigned.status,
      priority: assigned.priority,
      assigneeAgentId: assigned.assigneeAgentId!,
      parentTaskId: parentTask.id,
    });
  }

  const autoExecConfig = getAutoExecutionConfig();
  const autoExecutionEnabled = autoExecConfig.enabled;
  let executions: CeoDelegationExecutionResult[] = [];

  console.info("[CEO Delegate] Auto-execution config", {
    AUTO_EXECUTION_ENABLED: autoExecConfig.raw ?? "(unset)",
    enabled: autoExecutionEnabled,
    assignedTaskCount: assignedTaskItems.length,
    assignees: assignedTaskItems.map((t) => t.assigneeAgentId),
  });

  if (autoExecutionEnabled && assignedTaskItems.length > 0) {
    console.info("[CEO Delegate] Calling executeAssignedTasks", {
      count: assignedTaskItems.length,
    });

    const executionResults = await executeAssignedTasks(assignedTaskItems, {
      id: input.workspaceId,
      name: input.workspaceName,
    });

    executions = executionResults.map((result) => ({
      taskId: result.taskId,
      assigneeAgentId: result.assigneeAgentId,
      outcome: result.outcome,
      skipReason: result.skipReason,
      reportId: result.reportId,
      error: result.error,
    }));

    for (const result of executionResults) {
      const taskEntry = createdTasks.find((t) => t.id === result.taskId);
      if (!taskEntry) continue;

      if (result.outcome === "executed") {
        taskEntry.status = "review";
        taskEntry.linkedReportId = result.reportId;
      } else if (result.outcome === "failed") {
        taskEntry.status = "failed";
      }
    }
  }

  console.info("[CEO Delegate] Delegation complete", {
    parentTaskId: parentTask.id,
    taskCount: createdTasks.length,
    executionsRun: executions.filter((e) => e.outcome === "executed").length,
  });

  return {
    parentTaskId: parentTask.id,
    parentBrainRecordId: parentTask.brainRecordId,
    title: output.title,
    objective: output.objective,
    milestones: output.milestones,
    tasks: createdTasks,
    confidence: output.confidence,
    contextRecordCount: knowledge.brainContext.sourceRecordIds.length,
    autoExecutionEnabled,
    executions,
  };
}

export { CeoDelegationParseError, CeoKnowledgeError };
