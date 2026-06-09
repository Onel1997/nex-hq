"use client";

import { FacilityNavRail } from "@/components/facility/facility-nav-rail";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { I18nProvider } from "@/lib/i18n";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const isFacilityHome = pathname === "/";

  if (isFacilityHome) {
    return (
      <I18nProvider>
        <div className="facility-app-layout">
          <FacilityNavRail />
          <main className="facility-app-main">{children}</main>
        </div>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <DashboardHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </I18nProvider>
  );
}
