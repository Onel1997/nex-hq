"use client";

import type { CommandHistoryEntry } from "@/components/facility/hooks/use-command-history";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Rocket, Radio } from "lucide-react";
import { memo, useState } from "react";

const MISSION_TEMPLATES = [
  "Deploy SS27 Capsule Collection",
  "Launch Winter Campaign",
  "Research Luxury Streetwear Market",
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
  const isLaunching = status === "submitting";

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || status === "submitting") return;
    onSubmit(trimmed);
    setGoal("");
  };

  return (
    <div className="facility-mission-control">
      <div className="facility-mission-header">
        <Radio className="facility-mission-header-icon" strokeWidth={1.75} />
        <span className="facility-mission-header-label">Mission Control</span>
        <span className="facility-mission-header-status">
          {isLaunching ? "DEPLOYING" : "STANDBY"}
        </span>
      </div>

      <motion.form
        className={cn(
          "facility-mission-form",
          isLaunching && "facility-mission-form-launching",
          status === "success" && "facility-mission-form-success",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(goal);
        }}
        animate={
          isLaunching
            ? { boxShadow: "0 0 48px rgb(56 189 248 / 0.35)" }
            : { boxShadow: "0 0 24px rgb(0 0 0 / 0.4)" }
        }
      >
        <Mic className="facility-mission-mic" strokeWidth={1.5} aria-hidden />
        <input
          type="text"
          className="facility-mission-input"
          placeholder="Issue mission objective…"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          className="facility-mission-deploy"
          disabled={status === "submitting" || goal.trim().length < 3}
        >
          {isLaunching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Rocket className="size-3.5" />
              Deploy
            </>
          )}
        </button>
      </motion.form>

      <AnimatePresence mode="wait">
        {status !== "idle" && statusMessage ? (
          <motion.p
            key={statusMessage}
            className={cn(
              "facility-mission-status",
              status === "success" && "facility-mission-status-success",
              status === "error" && "facility-mission-status-error",
            )}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {statusMessage}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div className="facility-mission-templates">
        {MISSION_TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            className="facility-mission-template"
            onClick={() => setGoal(template)}
            disabled={status === "submitting"}
          >
            {template}
          </button>
        ))}
      </div>

      {history.length > 0 ? (
        <div className="facility-mission-history">
          {history.slice(0, 2).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="facility-mission-history-item"
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
