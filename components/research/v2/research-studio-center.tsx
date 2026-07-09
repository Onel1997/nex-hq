"use client";

import { ResearchStudioMissions } from "./research-studio-missions";
import { ResearchStudioPrompt } from "./research-studio-prompt";
import { ResearchStudioResult } from "./research-studio-result";
import { ResearchStudioRunning } from "./research-studio-running";
import { QUICK_MISSIONS } from "./missions";
import type { ResearchResult, ResearchRunPhase } from "./types";

interface ResearchStudioCenterProps {
  request: string;
  onRequestChange: (value: string) => void;
  onRun: (text: string) => void;
  isLoading: boolean;
  error: string | null;
  phase: ResearchRunPhase;
  result: ResearchResult | null;
  onReset: () => void;
}

export function ResearchStudioCenter({
  request,
  onRequestChange,
  onRun,
  isLoading,
  error,
  phase,
  result,
  onReset,
}: ResearchStudioCenterProps) {
  const showRunning = isLoading;
  const showResult = !isLoading && result != null;
  const showIdle = !isLoading && !result;

  return (
    <main className="research-studio-center">
      <div className="research-studio-center-scroll">
        {showRunning ? <ResearchStudioRunning phase={phase} /> : null}

        {showResult ? (
          <ResearchStudioResult result={result} onNewResearch={onReset} />
        ) : null}

        {showIdle ? (
          <div className="research-studio-idle">
            <ResearchStudioPrompt
              value={request}
              onChange={onRequestChange}
              onSubmit={onRun}
              disabled={isLoading}
            />
            <ResearchStudioMissions
              missions={QUICK_MISSIONS}
              onSelect={onRun}
              disabled={isLoading}
            />
          </div>
        ) : null}

        {error ? (
          <div className="research-studio-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="research-studio-btn research-studio-btn-ghost"
              onClick={onReset}
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
