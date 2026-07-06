"use client";

import { useEffect, useState } from "react";
import { PROMPT_PLACEHOLDERS } from "./missions";
import { cn } from "@/lib/utils";
import { ArrowUp, Loader2 } from "lucide-react";

interface ResearchStudioPromptProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function ResearchStudioPrompt({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: ResearchStudioPromptProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PROMPT_PLACEHOLDERS.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  return (
    <div className="research-studio-prompt">
      <h1 className="research-studio-prompt-headline">
        What do you want to research today?
      </h1>

      <form onSubmit={handleSubmit} className="research-studio-prompt-form">
        <div className="research-studio-prompt-box">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PROMPT_PLACEHOLDERS[placeholderIndex]}
            disabled={disabled}
            rows={5}
            className="research-studio-prompt-input"
            aria-label="Research prompt"
          />
          <div className="research-studio-prompt-footer">
            <span className="research-studio-prompt-hint">
              Enter to run · Shift+Enter for new line
            </span>
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className={cn(
                "research-studio-prompt-submit",
                disabled && "research-studio-prompt-submit-loading",
              )}
              aria-label="Run research"
            >
              {disabled ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
