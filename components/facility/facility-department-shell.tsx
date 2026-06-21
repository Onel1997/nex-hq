"use client";

import { FacilityWingNav } from "@/components/facility/facility-wing-nav";
import type { FacilityWingId } from "@/lib/facility/facility-routes";
import { cn } from "@/lib/utils";
import { ChevronRight, Home, type LucideIcon } from "lucide-react";
import Link from "next/link";

interface FacilityDepartmentShellProps {
  wingId: FacilityWingId;
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideWingNav?: boolean;
}

export function FacilityDepartmentShell({
  wingId,
  title,
  icon: Icon,
  subtitle,
  headerActions,
  children,
  className,
  hideWingNav = false,
}: FacilityDepartmentShellProps) {
  return (
    <div className={cn("facility-dept-shell", className)}>
      {!hideWingNav ? <FacilityWingNav activeWing={wingId} /> : null}

      <div className="facility-dept-main">
        <header className="facility-dept-header">
          <nav className="facility-dept-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/" className="facility-dept-crumb">
              <Home className="size-3.5" />
              Facility
            </Link>
            <ChevronRight className="size-3.5 opacity-40" />
            <span className="facility-dept-crumb facility-dept-crumb-current">
              <Icon className="size-3.5" />
              {title}
            </span>
          </nav>

          {headerActions ? (
            <div className="facility-dept-header-actions">{headerActions}</div>
          ) : null}
        </header>

        {subtitle ? (
          <div className="facility-dept-subtitle-bar">
            <p>{subtitle}</p>
          </div>
        ) : null}

        <div className="facility-dept-content">{children}</div>
      </div>
    </div>
  );
}
