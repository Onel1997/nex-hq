"use client";

import { useEffect, useState } from "react";
import { PROMPT_PLACEHOLDERS } from "./missions";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  ImagePlus,
  LayoutGrid,
  Mic,
  Paperclip,
} from "lucide-react";

interface ResearchStudioCommandInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ResearchStudioCommandInput({
  value,
  onChange,
}: ResearchStudioCommandInputProps) {
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PROMPT_PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <div className="rs3-command">
      <div
        className={cn(
          "rs3-command-shell",
          focused && "rs3-command-shell-focused",
        )}
      >
        <div className="rs3-command-glow" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={PROMPT_PLACEHOLDERS[placeholderIndex]}
          rows={4}
          className="rs3-command-input"
          aria-label="Research command"
        />
        <div className="rs3-command-toolbar">
          <div className="rs3-command-actions">
            <button
              type="button"
              className="rs3-command-action"
              title="Voice input — Coming Soon"
              disabled
            >
              <Mic className="size-4" />
              <span>Voice</span>
              <span className="rs3-command-soon">Soon</span>
            </button>
            <button
              type="button"
              className="rs3-command-action"
              title="Moodboard upload — Coming Soon"
              disabled
            >
              <LayoutGrid className="size-4" />
              <span>Moodboard</span>
              <span className="rs3-command-soon">Soon</span>
            </button>
            <button
              type="button"
              className="rs3-command-action"
              title="Reference upload — Coming Soon"
              disabled
            >
              <Paperclip className="size-4" />
              <span>Reference</span>
              <span className="rs3-command-soon">Soon</span>
            </button>
            <button
              type="button"
              className="rs3-command-action"
              title="Image upload — Coming Soon"
              disabled
            >
              <ImagePlus className="size-4" />
              <span>Image</span>
              <span className="rs3-command-soon">Soon</span>
            </button>
          </div>
          <button
            type="button"
            className="rs3-command-submit"
            disabled={!value.trim()}
            aria-label="Launch research — Coming Soon"
            title="Research workflow — Coming Soon"
          >
            <ArrowUp className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <p className="rs3-command-hint">
        Type or paste your research mission · Workflow launching soon
      </p>
    </div>
  );
}
