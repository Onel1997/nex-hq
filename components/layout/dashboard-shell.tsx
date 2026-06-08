"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <DashboardHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
