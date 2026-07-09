"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HQ_RAIL_ITEMS,
  isHqRailItemActive,
} from "@/lib/navigation/hq-navigation";
import { cn } from "@/lib/utils";

export function FacilityNavRail() {
  const pathname = usePathname();

  return (
    <nav className="facility-nav-rail" aria-label="HQ workspace">
      <Link href="/" className="facility-nav-logo" title="NexHQ">
        <span className="facility-nav-logo-mark">N</span>
      </Link>

      <div className="facility-nav-items">
        {HQ_RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isHqRailItemActive(item, pathname);
          return (
            <Link
              key={item.id}
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
