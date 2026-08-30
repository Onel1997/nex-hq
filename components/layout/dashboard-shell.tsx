"use client";

import Link from "next/link";

import { HqSidebar } from "@/components/navigation/hq-sidebar";
import { StudioMobileNavigation } from "@/components/navigation/studio-mobile-navigation";
import { I18nProvider } from "@/lib/i18n";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <I18nProvider>
      <div className="hq-app-layout">
        <HqSidebar />
        <header className="hq-owner-mobile-header">
          <Link href="/hq" className="hq-owner-mobile-brand" aria-label="Xeriamo Owner Startseite">
            <span aria-hidden="true">X</span>
            <span>
              <strong>Xeriamo</strong>
              <small>Owner Workspace</small>
            </span>
          </Link>
          <StudioMobileNavigation audience="OWNER" />
        </header>
        <main className="hq-app-main">
          <div className="hq-app-content">{children}</div>
        </main>
      </div>
    </I18nProvider>
  );
}
