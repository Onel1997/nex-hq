"use client";

import { FACILITY_DEGRADED_BANNER_MESSAGE } from "@/lib/facility/provider-errors";
import { AlertTriangle } from "lucide-react";

interface FacilityDegradedBannerProps {
  show?: boolean;
}

export function FacilityDegradedBanner({ show = false }: FacilityDegradedBannerProps) {
  if (!show) return null;

  return (
    <div className="facility-degraded-banner" role="status">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      <span>{FACILITY_DEGRADED_BANNER_MESSAGE}</span>
    </div>
  );
}
