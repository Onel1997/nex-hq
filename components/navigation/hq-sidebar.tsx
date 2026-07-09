"use client";

import { usePersistedCollapse } from "@/hooks/use-persisted-collapse";
import { usePersistedSections } from "@/hooks/use-persisted-sections";
import {
  HQ_SIDEBAR_SECTION_DEFAULTS,
  HQ_SIDEBAR_SECTIONS,
  isSidebarNavItemActive,
  resolveActiveSidebarSection,
  type HqSidebarSectionId,
  type SidebarNavItem,
} from "@/lib/navigation/hq-navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type CSSProperties } from "react";

const SIDEBAR_COLLAPSE_KEY = "nexhq-hq-sidebar-collapsed";
const SIDEBAR_SECTIONS_KEY = "nexhq-hq-sidebar-sections";

function SidebarNavLink({
  item,
  pathname,
  collapsed,
}: {
  item: SidebarNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const active = isSidebarNavItemActive(pathname, item);
  const accent = active ? (item.accent ?? "var(--hq-accent)") : undefined;

  return (
    <Link
      href={item.href}
      className={cn("hq-sidebar-item", active && "hq-sidebar-item-active")}
      style={
        active && accent
          ? ({ "--hq-item-accent": accent } as CSSProperties)
          : undefined
      }
      title={collapsed ? item.label : undefined}
    >
      <span
        className="hq-sidebar-item-icon"
        style={active && accent ? { color: accent } : undefined}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="hq-sidebar-item-label">{item.label}</span>
      {active ? <span className="hq-sidebar-item-active-bar" aria-hidden /> : null}
    </Link>
  );
}

export function HqSidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed, hydrated } = usePersistedCollapse(
    SIDEBAR_COLLAPSE_KEY,
    false,
  );
  const { sections, toggleSection, expandSection, hydrated: sectionsHydrated } =
    usePersistedSections(SIDEBAR_SECTIONS_KEY, HQ_SIDEBAR_SECTION_DEFAULTS);

  const activeSection = resolveActiveSidebarSection(pathname);

  useEffect(() => {
    expandSection(activeSection);
  }, [activeSection, expandSection]);

  const showLabels = hydrated && sectionsHydrated && !collapsed;

  return (
    <nav
      className={cn(
        "hq-sidebar",
        collapsed && "is-collapsed",
        (!hydrated || !sectionsHydrated) && "is-hydrating",
      )}
      aria-label="NexHQ navigation"
    >
      <div className="hq-sidebar-header">
        <Link href="/" className="hq-sidebar-logo" title="NexHQ">
          <span className="hq-sidebar-logo-mark">N</span>
          {showLabels ? <span className="hq-sidebar-logo-text">NexHQ</span> : null}
        </Link>
        <button
          type="button"
          className="hq-sidebar-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      </div>

      <div className="hq-sidebar-sections">
        {HQ_SIDEBAR_SECTIONS.map((section) => {
          const expanded = collapsed ? false : sections[section.id];
          const sectionActive = activeSection === section.id;

          return (
            <section
              key={section.id}
              className={cn(
                "hq-sidebar-section",
                sectionActive && "hq-sidebar-section-active",
              )}
            >
              <button
                type="button"
                className="hq-sidebar-section-toggle"
                onClick={() => toggleSection(section.id as HqSidebarSectionId)}
                aria-expanded={expanded}
                title={collapsed ? section.label : undefined}
              >
                <ChevronDown
                  className={cn(
                    "hq-sidebar-section-chevron size-3.5",
                    expanded && "is-open",
                  )}
                  aria-hidden
                />
                <span className="hq-sidebar-section-label">{section.label}</span>
              </button>

              <div
                className={cn(
                  "hq-sidebar-section-items",
                  (expanded || collapsed) && "is-expanded",
                )}
              >
                {section.items.map((item) => (
                  <SidebarNavLink
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </nav>
  );
}
