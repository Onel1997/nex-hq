"use client";

import { cn } from "@/lib/utils";
import type { DepartmentHqSignal } from "./types";

interface DepartmentHqSignalsProps {
  signals: DepartmentHqSignal[];
  className?: string;
}

export function DepartmentHqSignals({ signals, className }: DepartmentHqSignalsProps) {
  return (
    <ul className={cn("dhq-signal-list", className)}>
      {signals.map((signal, index) => (
        <li
          key={signal.id}
          className={cn("dhq-signal-card", `dhq-signal-${signal.status}`)}
          style={{ ["--dhq-signal-delay" as string]: `${index * 0.35}s` }}
        >
          <span className="dhq-signal-indicator" aria-hidden />
          <div>
            <p className="dhq-signal-label">{signal.label}</p>
            {signal.detail ? (
              <p className="dhq-signal-detail">{signal.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
