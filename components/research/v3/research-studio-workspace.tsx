"use client";

import { ResearchStudioError } from "./research-studio-error";
import { ResearchStudioHero } from "./research-studio-hero";
import { ResearchStudioResult } from "./research-studio-result";
import { ResearchStudioRunning } from "./research-studio-running";
import type { ResearchResult, ResearchRunError, ResearchRunPhase } from "./types";

interface ResearchStudioWorkspaceProps {
  request: string;
  onRequestChange: (value: string) => void;
  onSubmit: (text: string) => void;
  isLoading: boolean;
  error: ResearchRunError | null;
  phase: ResearchRunPhase;
  result: ResearchResult | null;
  onReset: () => void;
  onRetry: () => void;
  onSelectMission: (prompt: string) => void;
}

export function ResearchStudioWorkspace({
  request,
  onRequestChange,
  onSubmit,
  isLoading,
  error,
  phase,
  result,
  onReset,
  onRetry,
  onSelectMission,
}: ResearchStudioWorkspaceProps) {
  const showRunning = isLoading;
  const showResult = !isLoading && result != null;
  const showIdle = !isLoading && !result;

  return (
    <div className="rs3-workspace">
      {showRunning ? <ResearchStudioRunning phase={phase} /> : null}

      {showResult ? (
        <ResearchStudioResult result={result} onNewResearch={onReset} />
      ) : null}

      {showIdle ? (
        <ResearchStudioHero
          request={request}
          onRequestChange={onRequestChange}
          onSelectMission={onSelectMission}
          onSubmit={onSubmit}
          disabled={isLoading}
        />
      ) : null}

      {error && !isLoading ? (
        <ResearchStudioError
          error={error}
          onRetry={onRetry}
          onDismiss={onReset}
        />
      ) : null}
    </div>
  );
}
