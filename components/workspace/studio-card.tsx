"use client";

import { cn } from "@/lib/utils";
import {
  Check,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export interface StudioCardProps {
  title: string;
  subtitle?: string;
  preview?: React.ReactNode;
  status?: "empty" | "draft" | "ready" | "generating";
  onGenerate?: () => void;
  onApprove?: () => void;
  onRegenerate?: () => void;
  generateLoading?: boolean;
  className?: string;
}

export function StudioCard({
  title,
  subtitle,
  preview,
  status = "empty",
  onGenerate,
  onApprove,
  onRegenerate,
  generateLoading = false,
  className,
}: StudioCardProps) {
  const showActions = status !== "empty" || onGenerate;

  return (
    <article
      className={cn(
        "workspace-studio-card group",
        status === "empty" && "workspace-studio-card-empty",
        className,
      )}
    >
      <div className="workspace-studio-card-preview">
        {preview ?? (
          <div className="workspace-studio-card-placeholder">
            <ImageIcon className="size-10 opacity-30" strokeWidth={1.25} />
          </div>
        )}
        {status === "generating" ? (
          <div className="workspace-studio-card-overlay">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : null}
      </div>

      <div className="workspace-studio-card-body">
        <div className="workspace-studio-card-meta">
          <h3 className="workspace-studio-card-title">{title}</h3>
          {subtitle ? (
            <p className="workspace-studio-card-subtitle">{subtitle}</p>
          ) : null}
        </div>

        {showActions ? (
          <div className="workspace-studio-card-actions">
            {onGenerate ? (
              <button
                type="button"
                className="workspace-studio-action workspace-studio-action-primary"
                onClick={onGenerate}
                disabled={generateLoading}
              >
                {generateLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Generate
              </button>
            ) : null}
            {onApprove && status !== "empty" ? (
              <button
                type="button"
                className="workspace-studio-action"
                onClick={onApprove}
              >
                <Check className="size-3.5" />
                Approve
              </button>
            ) : null}
            {onRegenerate && status !== "empty" ? (
              <button
                type="button"
                className="workspace-studio-action"
                onClick={onRegenerate}
              >
                <RefreshCw className="size-3.5" />
                Regenerate
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
