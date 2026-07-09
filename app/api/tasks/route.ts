import { NextResponse } from "next/server";
import { listTasks, TaskServiceError } from "@/lib/tasks/task-service";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured, tasks: [] },
        { status: 503 },
      );
    }

    const result = await listTasks();

    return NextResponse.json({
      tasks: result.tasks,
      workspaceId: result.workspaceId,
      workspaceName: result.workspaceName,
      total: result.tasks.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.research.errors.unexpected;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { createTaskSchema } = await import("@/lib/tasks/validation");
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.research.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { createTask } = await import("@/lib/tasks/task-service");
    const result = await createTask({
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: parsed.data.status,
      assigneeAgentId: parsed.data.assigneeAgentId ?? null,
      parentTaskId: parsed.data.parentTaskId ?? null,
      payload: parsed.data.payload,
      createdByAgentId: parsed.data.createdByAgentId ?? "human",
    });

    return NextResponse.json({
      success: true,
      task: result.task,
      eventIds: result.eventIds,
    });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : dict.research.errors.unexpected;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
