import type { TaskStatus } from "@/tasks/types";
import { TASK_STATUS_ORDER } from "@/tasks/types";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

export { TASK_STATUS_ORDER };

export function getTaskStatusLabels(
  locale: Locale,
): Record<TaskStatus, string> {
  const { common } = getDictionary(locale);
  return { ...common.taskStatus };
}
