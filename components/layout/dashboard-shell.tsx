"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HqSidebar } from "@/components/navigation/hq-sidebar";
import { StudioMobileNavigation } from "@/components/navigation/studio-mobile-navigation";
import { XeriamoBrandIdentity } from "@/components/xeriano/brand-identity";
import { I18nProvider } from "@/lib/i18n";
import { isXeriamoOwnerProductRoute } from "@/lib/xeriano/owner-product-routes";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const ownerProductRoute = isXeriamoOwnerProductRoute(pathname);

  return (
    <I18nProvider>
      <div className={`hq-app-layout${ownerProductRoute ? " is-owner-product" : ""}`}>
        <HqSidebar />
        <header className="hq-owner-mobile-header">
          <Link href="/hq" className="hq-owner-mobile-brand" aria-label="Xeriamo Owner Startseite">
            <span aria-hidden="true"><XeriamoBrandIdentity role="ICON" markOnly /></span>
            <span className="hq-owner-mobile-brand-copy">
              <XeriamoBrandIdentity role="LOGO" />
            </span>
          </Link>
          <StudioMobileNavigation audience="OWNER" />
        </header>
        <main className="hq-app-main">
          <div className={`hq-app-content${ownerProductRoute ? " xeriamo-owner-product" : ""}`}>
            {children}
          </div>
        </main>
      </div>
    </I18nProvider>
  );
}
