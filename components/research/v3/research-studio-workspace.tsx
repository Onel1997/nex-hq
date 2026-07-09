"use client";

import { ResearchStudioError } from "./research-studio-error";
import { ResearchStudioHero } from "./research-studio-hero";
import { ResearchStudioResult } from "./research-studio-result";
import { ResearchStudioRunning } from "./research-studio-running";
import type { ProviderSnapshot } from "./data-source-types";
import type {
  FusionReportError,
  ResearchResultV3,
  ResearchRunError,
  ResearchRunPhase,
} from "./types";

interface ResearchStudioWorkspaceProps {
  request: string;
  onRequestChange: (value: string) => void;
  onSubmit: (text: string) => void;
  isLoading: boolean;
  error: ResearchRunError | null;
  fusionError: FusionReportError | null;
  fusionRetrying: boolean;
  phase: ResearchRunPhase;
  result: ResearchResultV3 | null;
  providers: ProviderSnapshot[];
  onReset: () => void;
  onRetry: () => void;
  onRetryFusion: () => void;
  onSelectMission: (prompt: string) => void;
}

export function ResearchStudioWorkspace({
  request,
  onRequestChange,
  onSubmit,
  isLoading,
  error,
  fusionError,
  fusionRetrying,
  phase,
  result,
  providers,
  onReset,
  onRetry,
  onRetryFusion,
  onSelectMission,
}: ResearchStudioWorkspaceProps) {
  const showRunning = isLoading;
  const showResult = !isLoading && result != null;
  const showIdle = !isLoading && !result;

  return (
    <div className="rs3-workspace">
      {showRunning ? <ResearchStudioRunning phase={phase} /> : null}

      {showResult ? (
        <ResearchStudioResult
          result={result}
          providers={providers}
          fusionError={fusionError}
          fusionRetrying={fusionRetrying}
          onRetryFusion={onRetryFusion}
          onNewResearch={onReset}
        />
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
