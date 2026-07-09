"use client";

import { cn } from "@/lib/utils";
import type { DepartmentHqMetric } from "./types";

interface DepartmentHqMetricsProps {
  metrics: DepartmentHqMetric[];
  className?: string;
}

export function DepartmentHqMetrics({
  metrics,
  className,
}: DepartmentHqMetricsProps) {
  return (
    <div className={cn("dhq-metrics", className)}>
      {metrics.map((metric) => (
        <div
          key={metric.id}
          className={cn(
            "dhq-metric",
            metric.pulse && "dhq-metric-pulse",
            metric.glow && "dhq-metric-glow",
            metric.trend === "up" && "dhq-metric-up",
            metric.trend === "down" && "dhq-metric-down",
          )}
        >
          <span className="dhq-metric-label">{metric.label}</span>
          <span className="dhq-metric-value">{metric.value}</span>
        </div>
      ))}
    </div>
  );
}
