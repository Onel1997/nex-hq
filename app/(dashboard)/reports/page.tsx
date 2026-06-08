import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { ReportHub } from "@/components/reports/report-hub";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.navigation.reports,
};

export default function ReportsPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.reports.page.title}
        description={dict.reports.page.description}
      />

      <ReportHub />
    </CommandSurface>
  );
}
