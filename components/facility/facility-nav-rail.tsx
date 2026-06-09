"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Facility" },
  { href: "/agents", icon: Users, label: "Agents" },
  { href: "/brain", icon: Brain, label: "Brain" },
  { href: "/tasks", icon: ClipboardList, label: "Tasks" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export function FacilityNavRail() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
