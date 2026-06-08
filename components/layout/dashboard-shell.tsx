"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { I18nProvider } from "@/lib/i18n";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
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
