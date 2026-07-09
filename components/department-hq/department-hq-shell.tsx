"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DepartmentHqShellProps {
  className?: string;
  accent?: string;
  children: ReactNode;
}

export function DepartmentHqShell({
  className,
  accent = "#7cff7a",
  children,
}: DepartmentHqShellProps) {
  return (
    <div
      className={cn("dhq-shell", className)}
      style={{ ["--dhq-accent" as string]: accent }}
    >
      <div className="dhq-scanlines" aria-hidden />
      <div className="dhq-atmosphere" aria-hidden>
        {Array.from({ length: 32 }).map((_, index) => (
          <span
            key={index}
            className="dhq-atmo-particle"
            style={{
              ["--dhq-a-x" as string]: `${(index * 19) % 100}%`,
              ["--dhq-a-y" as string]: `${(index * 31) % 100}%`,
              ["--dhq-a-d" as string]: `${5 + (index % 7)}s`,
              ["--dhq-a-delay" as string]: `${(index * 0.35) % 6}s`,
            }}
          />
        ))}
      </div>
      <div className="dhq-content">{children}</div>
    </div>
  );
}
