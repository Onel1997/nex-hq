"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FACILITY_WINGS,
  type FacilityWingId,
} from "@/lib/facility/facility-routes";
import { cn } from "@/lib/utils";
import {
  Archive,
  BarChart3,
  Brain,
  ClipboardList,
  FileText,
  Lock,
  Users,
  type LucideIcon,
} from "lucide-react";

const WING_ICONS: Record<FacilityWingId, LucideIcon> = {
  agents: Users,
  reports: FileText,
  knowledge: Archive,
  "brain-core": Brain,
  "mission-control": ClipboardList,
  analytics: BarChart3,
};

interface FacilityWingNavProps {
  activeWing: FacilityWingId;
}

export function FacilityWingNav({ activeWing }: FacilityWingNavProps) {
  const pathname = usePathname();

  return (
    <nav className="facility-wing-nav" aria-label="Facility wings">
      <div className="facility-wing-nav-header">
        <span className="facility-wing-nav-label">Facility Wings</span>
      </div>

      <ul className="facility-wing-nav-list">
        {FACILITY_WINGS.map((wing) => {
          const Icon = WING_ICONS[wing.id];
          const active =
            wing.id === activeWing ||
            (wing.href != null &&
              (pathname === wing.href || pathname.startsWith(`${wing.href}/`)));

          if (wing.comingSoon || !wing.href) {
            return (
              <li key={wing.id}>
                <span
                  className="facility-wing-nav-item facility-wing-nav-item-disabled"
                  title="Coming online"
                >
                  <span className="facility-wing-nav-icon-wrap">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="facility-wing-nav-text">
                    <span className="facility-wing-nav-name">{wing.label}</span>
                    <span className="facility-wing-nav-soon">Coming online</span>
                  </span>
                  <Lock className="facility-wing-nav-lock size-3" />
                </span>
              </li>
            );
          }

          return (
            <li key={wing.id}>
              <Link
                href={wing.href}
                className={cn(
                  "facility-wing-nav-item",
                  active && "facility-wing-nav-item-active",
                )}
              >
                <span className="facility-wing-nav-icon-wrap">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="facility-wing-nav-text">
                  <span className="facility-wing-nav-name">{wing.label}</span>
                </span>
                {active ? (
                  <span className="facility-wing-nav-active-bar" aria-hidden />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
