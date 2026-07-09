/**
 * Resolve report ↔ task linkage for agent outputs.
 */

export function resolveReportTaskIds(
  originTaskId: string | undefined,
  reportId: string,
  agentPrefix: string,
): { taskId: string; originTaskId?: string } {
  if (originTaskId) {
    return {
      taskId: originTaskId,
      originTaskId,
    };
  }

  return {
    taskId: `${agentPrefix}-${reportId}`,
  };
}
