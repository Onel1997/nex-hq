import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

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
      />
      <TaskBoard />
    </CommandSurface>
  );
}
