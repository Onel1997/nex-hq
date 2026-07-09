"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { DepartmentHqDecision } from "./types";

interface DepartmentHqDecisionsProps {
  decisions: DepartmentHqDecision[];
  title?: string;
  className?: string;
}

export function DepartmentHqDecisions({
  decisions,
  title = "Decisions",
  className,
}: DepartmentHqDecisionsProps) {
  return (
    <section className={cn("dhq-decisions", className)} aria-label="Decisions panel">
      <header className="dhq-decisions-header">
        <Sparkles className="size-4" />
        <h2>{title}</h2>
        <span>{decisions.length} queued</span>
      </header>
      <div className="dhq-decisions-grid">
        {decisions.map((decision) => (
          <article
            key={decision.id}
            className={cn("dhq-decision-card", `dhq-decision-${decision.priority}`)}
          >
            <header>
              <span className="dhq-decision-priority">{decision.priority}</span>
              <span className="dhq-decision-confidence">
                {Math.round(decision.confidence)}% confidence
              </span>
            </header>
            <h3>{decision.title}</h3>
            <footer>
              {decision.agents.map((agent) => (
                <span key={agent}>{agent}</span>
              ))}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
