import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Plus } from "lucide-react";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.navigation.tasks,
};

export default function TasksPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.tasks.page.title}
        description={dict.tasks.page.description}
      >
        <Button size="lg" disabled className="gap-2">
          <Plus className="size-4" />
          {dict.tasks.page.newTask}
        </Button>
      </PageHeader>

      <TaskBoard />
    </CommandSurface>
  );
}
