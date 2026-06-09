"use client";

import type { CommandHistoryEntry } from "@/components/facility/hooks/use-command-history";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { memo, useState } from "react";

const EXAMPLE_OBJECTIVES = [
  "Create SS27 Capsule Collection",
  "Launch Urban Echoes Campaign",
  "Research Luxury Streetwear Trends",
];

export type DelegationStatus = "idle" | "submitting" | "success" | "error";

interface CommandDockProps {
  history: CommandHistoryEntry[];
  status: DelegationStatus;
  statusMessage?: string;
  onSubmit: (goal: string) => void;
}

export const CommandDock = memo(function CommandDock({
  history,
  status,
  statusMessage,
  onSubmit,
}: CommandDockProps) {
  const [goal, setGoal] = useState("");

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || status === "submitting") return;
    onSubmit(trimmed);
    setGoal("");
  };

  return (
    <div className="facility-command-dock">
      <form
        className="facility-command-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(goal);
        }}
      >
        <span className="facility-command-prompt">▸</span>
        <input
          type="text"
          className="facility-command-input"
          placeholder="Enter objective…"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          className="facility-command-submit"
          disabled={status === "submitting" || goal.trim().length < 3}
        >
          {status === "submitting" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              Run
              <ArrowRight className="size-3.5" />
            </>
          )}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {status !== "idle" && statusMessage ? (
          <motion.p
            key={statusMessage}
            className={cn(
              "facility-command-status",
              status === "success" && "facility-command-status-success",
              status === "error" && "facility-command-status-error",
            )}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {statusMessage}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div className="facility-command-examples">
        {EXAMPLE_OBJECTIVES.map((example) => (
          <button
            key={example}
            type="button"
            className="facility-command-example"
            onClick={() => setGoal(example)}
            disabled={status === "submitting"}
          >
            {example}
          </button>
        ))}
      </div>

      {history.length > 0 ? (
        <div className="facility-command-history">
          <span className="facility-command-history-label">Recent</span>
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="facility-command-history-item"
              onClick={() => setGoal(entry.goal)}
              disabled={status === "submitting"}
            >
              {entry.goal}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
