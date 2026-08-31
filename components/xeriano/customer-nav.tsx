"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

import { StudioMobileNavigation } from "@/components/navigation/studio-mobile-navigation";
import { XeriamoBrandLockup } from "@/components/xeriano/brand-identity";
import { useLocale } from "@/lib/i18n";
import {
  getStudioSidebarSections,
  isSidebarNavItemActive,
} from "@/lib/navigation/hq-navigation";

export function XerianoCustomerNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const sections = getStudioSidebarSections(locale, "CUSTOMER");

  const navigation = sections.map((section) => (
    <section key={section.id}>
      <h2>{section.label}</h2>
      <div>
        {section.items.map((item) => {
          const active = isSidebarNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              style={{ "--xe-nav-accent": item.accent ?? "#a78bfa" } as CSSProperties}
            >
              <span><Icon size={18} /></span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </section>
  ));

  return (
    <>
      <aside className="xeriano-customer-sidebar">
        <Link className="xeriano-wordmark" href="/app" aria-label="Xeriamo Home"><XeriamoBrandLockup /></Link>
        <nav aria-label="Xeriamo Studios">{navigation}</nav>
      </aside>
      <header className="xeriano-customer-mobile-header">
        <Link className="xeriano-wordmark" href="/app" aria-label="Xeriamo Home"><XeriamoBrandLockup /></Link>
        <StudioMobileNavigation audience="CUSTOMER" />
      </header>
    </>
  );
}
