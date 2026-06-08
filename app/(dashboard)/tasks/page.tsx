import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Tasks",
};

export default function TasksPage() {
  return (
    <CommandSurface>
      <PageHeader
        title="Tasks"
        description="The operational pulse of your brand — every drop, campaign, and creative directive."
      >
        <Button size="lg" disabled className="gap-2">
          <Plus className="size-4" />
          New Task
        </Button>
      </PageHeader>

      <TaskBoard />
    </CommandSurface>
  );
}
