import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { ReportHub } from "@/components/reports/report-hub";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <CommandSurface>
      <PageHeader
        title="Reports"
        description="Intelligence from your AI team — research, design, and marketing briefs."
      />

      <ReportHub />
    </CommandSurface>
  );
}
