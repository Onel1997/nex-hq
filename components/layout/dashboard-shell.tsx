"use client";

import { ContextSidebar } from "@/components/navigation/context-sidebar";
import { FacilityNavRail } from "@/components/facility/facility-nav-rail";
import { FacilityPageTransition } from "@/components/facility/facility-page-transition";
import { I18nProvider } from "@/lib/i18n";
import { shouldShowContextSidebar } from "@/lib/navigation/hq-navigation";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const showContextSidebar = shouldShowContextSidebar(pathname);

  return (
    <I18nProvider>
      <div className="facility-app-layout">
        <div
          className={
            showContextSidebar
              ? "hq-nav-cluster"
              : "hq-nav-cluster hq-nav-cluster-rail-only"
          }
        >
          <FacilityNavRail />
          {showContextSidebar ? <ContextSidebar /> : null}
        </div>
        <main className="facility-app-main">
          <FacilityPageTransition className="facility-app-transition">
            {children}
          </FacilityPageTransition>
        </main>
      </div>
    </I18nProvider>
  );
}
