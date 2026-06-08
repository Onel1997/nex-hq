import { NextResponse } from "next/server";
import {
  deleteTask,
  getTask,
  TaskServiceError,
  updateTask,
} from "@/lib/tasks/task-service";
import { updateTaskSchema } from "@/lib/tasks/validation";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

function handleTaskError(error: unknown) {
  if (error instanceof TaskServiceError) {
    const status = error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const message =
    error instanceof Error ? error.message : dict.research.errors.unexpected;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const task = await getTask(id);

    return NextResponse.json({ task });
  } catch (error) {
    return handleTaskError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.research.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await updateTask(id, parsed.data);

    return NextResponse.json({
      success: true,
      task: result.task,
      eventIds: result.eventIds,
    });
  } catch (error) {
    return handleTaskError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const result = await deleteTask(id);

    return NextResponse.json(result);
  } catch (error) {
    return handleTaskError(error);
  }
}
