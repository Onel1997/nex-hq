import { assertTaskExists } from "@/lib/tasks/task-service";

/** Validate and resolve a public task ID for agent report linking. */
export async function resolveOriginTaskId(
  taskId?: string,
): Promise<string | undefined> {
  if (!taskId) {
    return undefined;
  }

  const task = await assertTaskExists(taskId);
  return task.id;
}
