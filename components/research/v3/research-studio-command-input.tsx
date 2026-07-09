"use client";

import { useEffect, useState } from "react";
import { PROMPT_PLACEHOLDERS } from "./missions";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Mic,
  Paperclip,
} from "lucide-react";

interface ResearchStudioCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function ResearchStudioCommandInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
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
      if (!disabled && value.trim()) {
        onSubmit(value);
      }
    }
  };

  const handleSubmit = () => {
    if (!disabled && value.trim()) {
      onSubmit(value);
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
          disabled={disabled}
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
            disabled={disabled || !value.trim()}
            onClick={handleSubmit}
            aria-label="Launch research"
            title="Launch research"
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
      <p className="rs3-command-hint">
        Enter to launch · Shift+Enter for new line
      </p>
    </div>
  );
}
