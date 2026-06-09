"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { I18nProvider } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const isFacilityHome = pathname === "/";

  return (
    <I18nProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset
          className={cn(
            "overflow-hidden",
            isFacilityHome && "md:m-0 md:rounded-none md:shadow-none",
          )}
        >
          <DashboardHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </I18nProvider>
  );
}
