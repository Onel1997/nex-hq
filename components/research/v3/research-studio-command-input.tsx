"use client";

import { useEffect, useState } from "react";
import { useLocale, useDictionary } from "@/lib/i18n";
import { getPromptPlaceholders } from "@/lib/i18n/data/research-studio";
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
  const locale = useLocale();
  const { research } = useDictionary();
  const copy = research.studio.command;
  const placeholders = getPromptPlaceholders(locale);
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [placeholders.length]);

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
          placeholder={placeholders[placeholderIndex]}
          rows={4}
          className="rs3-command-input"
          aria-label={copy.ariaLabel}
          disabled={disabled}
        />
        <div className="rs3-command-toolbar">
          <div className="rs3-command-actions">
            <button
              type="button"
              className="rs3-command-action"
              title={copy.voiceTitle}
              disabled
            >
              <Mic className="size-4" />
              <span>{copy.voice}</span>
              <span className="rs3-command-soon">{copy.soon}</span>
            </button>
            <button
              type="button"
              className="rs3-command-action"
              title={copy.moodboardTitle}
              disabled
            >
              <LayoutGrid className="size-4" />
              <span>{copy.moodboard}</span>
              <span className="rs3-command-soon">{copy.soon}</span>
            </button>
            <button
              type="button"
              className="rs3-command-action"
              title={copy.referenceTitle}
              disabled
            >
              <Paperclip className="size-4" />
              <span>{copy.reference}</span>
              <span className="rs3-command-soon">{copy.soon}</span>
            </button>
            <button
              type="button"
              className="rs3-command-action"
              title={copy.imageTitle}
              disabled
            >
              <ImagePlus className="size-4" />
              <span>{copy.image}</span>
              <span className="rs3-command-soon">{copy.soon}</span>
            </button>
          </div>
          <button
            type="button"
            className="rs3-command-submit"
            disabled={disabled || !value.trim()}
            onClick={handleSubmit}
            aria-label={copy.launchAria}
            title={copy.launchTitle}
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
      <p className="rs3-command-hint">{copy.hint}</p>
    </div>
  );
}
