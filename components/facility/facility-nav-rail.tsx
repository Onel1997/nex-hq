"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FACILITY_ROUTES } from "@/lib/facility/facility-routes";
import { cn } from "@/lib/utils";
import {
  Archive,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

const RAIL_ITEMS = [
  { href: FACILITY_ROUTES.home, icon: LayoutDashboard, label: "Facility" },
  { href: FACILITY_ROUTES.agents, icon: Users, label: "Agents" },
  { href: FACILITY_ROUTES.missions, icon: ClipboardList, label: "Mission Control" },
  { href: FACILITY_ROUTES.reports, icon: FileText, label: "Reports" },
  { href: FACILITY_ROUTES.knowledge, icon: Archive, label: "Knowledge Vault" },
  { href: FACILITY_ROUTES.settings, icon: Settings, label: "Settings" },
] as const;

export function FacilityNavRail() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === FACILITY_ROUTES.home) return pathname === "/";
    if (href === FACILITY_ROUTES.missions) {
      return (
        pathname.startsWith("/facility/missions") ||
        pathname.startsWith("/facility/tasks")
      );
    }
    if (href === FACILITY_ROUTES.agents) {
      return (
        pathname.startsWith("/facility/agents") ||
        (pathname.startsWith("/agents") && pathname !== "/agents")
      );
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="facility-nav-rail" aria-label="Facility navigation">
      <Link href="/" className="facility-nav-logo" title="NexHQ">
        <span className="facility-nav-logo-mark">N</span>
      </Link>

      <div className="facility-nav-items">
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "facility-nav-item",
                active && "facility-nav-item-active",
              )}
              title={item.label}
            >
              <Icon className="facility-nav-icon" strokeWidth={1.75} />
              <span className="facility-nav-tooltip">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
