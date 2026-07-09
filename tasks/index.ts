/**
 * Task system — Brain-backed work units for NexHQ operations.
 */

export type {
  CreateTaskInput,
  Task,
  TaskListItem,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_ORDER,
} from "./types";

export {
  assignTask,
  assertTaskExists,
  createTask,
  deleteTask,
  getTask,
  getTaskByTaskId,
  listTasks,
  updateTask,
  TaskServiceError,
} from "@/lib/tasks/task-service";

export {
  ceoAssignTask,
  ceoCreateTask,
  ceoGetTask,
  ceoGetTaskByTaskId,
  ceoListTasksForAssignee,
  ceoUpdateTaskStatus,
} from "@/lib/tasks/ceo-service";
