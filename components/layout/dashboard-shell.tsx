"use client";

import { HqSidebar } from "@/components/navigation/hq-sidebar";
import { FacilityPageTransition } from "@/components/facility/facility-page-transition";
import { I18nProvider } from "@/lib/i18n";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <I18nProvider>
      <div className="facility-app-layout">
        <HqSidebar />
        <main className="facility-app-main">
          <FacilityPageTransition className="facility-app-transition">
            {children}
          </FacilityPageTransition>
        </main>
      </div>
    </I18nProvider>
  );
}
