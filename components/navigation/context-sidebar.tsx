"use client";

import { usePersistedCollapse } from "@/hooks/use-persisted-collapse";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getContextNavItems,
  HQ_SECTION_LABELS,
  resolveHqSection,
  type ContextNavItem,
} from "@/lib/navigation/hq-navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

const AGENTS_SIDEBAR_KEY = "nexhq-agents-sidebar-collapsed";

function isItemActive(pathname: string, item: ContextNavItem): boolean {
  if (item.isActive) return item.isActive(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ContextSidebar() {
  const pathname = usePathname();
  const section = resolveHqSection(pathname);
  const items = getContextNavItems(section);
  const { collapsed, setCollapsed, hydrated } = usePersistedCollapse(AGENTS_SIDEBAR_KEY, false);

  return (
    <nav
      className={cn(
        "hq-context-sidebar",
        collapsed && "is-collapsed",
        !hydrated && "is-hydrating",
      )}
      aria-label={`${HQ_SECTION_LABELS[section]} navigation`}
      aria-expanded={!collapsed}
    >
      <div className="hq-context-sidebar-header">
        <span className="hq-context-sidebar-title">{HQ_SECTION_LABELS[section]}</span>
        <button
          type="button"
          className="hq-context-sidebar-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </div>

      <ul className="hq-context-sidebar-list">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(pathname, item);
          const accent = active ? (item.accent ?? "var(--hq-accent)") : undefined;

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "hq-context-sidebar-item",
                  active && "hq-context-sidebar-item-active",
                )}
                style={
                  active && accent
                    ? ({ "--hq-item-accent": accent } as CSSProperties)
                    : undefined
                }
                title={collapsed ? item.label : undefined}
              >
                <span
                  className="hq-context-sidebar-icon"
                  style={active && accent ? { color: accent } : undefined}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="hq-context-sidebar-label">{item.label}</span>
                {active ? (
                  <span className="hq-context-sidebar-active-bar" aria-hidden />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
