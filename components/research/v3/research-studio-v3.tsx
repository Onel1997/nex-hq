"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useWorkspace } from "@/lib/i18n";
import { ResearchStudioAtmosphere } from "./research-studio-atmosphere";
import { ResearchStudioDataSourcesCenter } from "./research-studio-data-sources-center";
import { ResearchStudioWorkspace } from "./research-studio-workspace";
import { useResearchRun } from "./use-research-run";
import { useDataSources } from "./use-data-sources";
import { ChevronRight, Database, Home, Sparkles } from "lucide-react";

export function ResearchStudioV3() {
  const workspace = useWorkspace();
  const [dataSourcesOpen, setDataSourcesOpen] = useState(false);

  const {
    request,
    setRequest,
    isLoading,
    error: runError,
    fusionError,
    fusionRetrying,
    result,
    phase,
    runResearch,
    reset,
    retry,
    retryFusionReport,
  } = useResearchRun();

  const {
    snapshot,
    settings,
    settingsLoading,
    openDataSourcesCenter,
    refreshDataSourcesCenter,
    runProviderAction,
  } = useDataSources();

  const handleSelectMission = useCallback(
    (prompt: string) => {
      setRequest(prompt);
    },
    [setRequest],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      void runResearch(text);
    },
    [runResearch],
  );

  const handleOpenDataSources = useCallback(async () => {
    setDataSourcesOpen(true);
    await openDataSourcesCenter();
  }, [openDataSourcesCenter]);

  const providers = snapshot?.providers ?? [];

  return (
    <div className="rs3">
      <ResearchStudioAtmosphere />

      <header className="rs3-topbar">
        <nav className="rs3-breadcrumb" aria-label="Breadcrumb">
          <Link href="/" className="rs3-breadcrumb-link">
            <Home className="size-3.5" />
            <span>Facility</span>
          </Link>
          <ChevronRight className="size-3.5 opacity-35" aria-hidden />
          <span className="rs3-breadcrumb-current">Research Studio</span>
        </nav>

        <div className="rs3-topbar-meta">
          <span className="rs3-topbar-badge">
            <Sparkles className="size-3" />
            {snapshot
              ? `${snapshot.liveCount} live · ${snapshot.connectedCount} connected`
              : "Live Intelligence"}
          </span>
          <button
            type="button"
            className="rs3-topbar-dsc-btn"
            onClick={() => void handleOpenDataSources()}
          >
            <Database className="size-3.5" />
            Data Sources
          </button>
          <span className="rs3-topbar-workspace">{workspace.name}</span>
        </div>
      </header>

      <div className="rs3-body">
        <main className="rs3-main rs3-main-full">
          <div className="rs3-main-scroll">
            <ResearchStudioWorkspace
              request={request}
              onRequestChange={setRequest}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              error={runError}
              fusionError={fusionError}
              fusionRetrying={fusionRetrying}
              phase={phase}
              result={result}
              providers={providers}
              onReset={reset}
              onRetry={retry}
              onRetryFusion={() => void retryFusionReport()}
              onSelectMission={handleSelectMission}
            />
          </div>
        </main>
      </div>

      <ResearchStudioDataSourcesCenter
        open={dataSourcesOpen}
        onClose={() => setDataSourcesOpen(false)}
        settings={settings}
        loading={settingsLoading}
        onRefreshAll={refreshDataSourcesCenter}
        onAction={runProviderAction}
      />
    </div>
  );
}
