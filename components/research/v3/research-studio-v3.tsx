"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/lib/i18n";
import { ResearchStudioAtmosphere } from "./research-studio-atmosphere";
import { ResearchStudioDataSourcesCenter } from "./research-studio-data-sources-center";
import { ResearchStudioHero } from "./research-studio-hero";
import { ResearchStudioSidebarLeft } from "./research-studio-sidebar-left";
import { ResearchStudioSidebarRight } from "./research-studio-sidebar-right";
import { useDataSources } from "./use-data-sources";
import { ChevronRight, Database, Home, Sparkles } from "lucide-react";

const MOBILE_BREAKPOINT = 1100;

export function ResearchStudioV3() {
  const workspace = useWorkspace();
  const [request, setRequest] = useState("");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [dataSourcesOpen, setDataSourcesOpen] = useState(false);

  const {
    snapshot,
    settings,
    loading: sourcesLoading,
    refreshing,
    settingsLoading,
    error: sourcesError,
    refreshAll,
    refreshProvider,
    openDataSourcesCenter,
    refreshDataSourcesCenter,
    runProviderAction,
  } = useDataSources();

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const apply = () => {
      if (mq.matches) {
        setLeftCollapsed(true);
        setRightCollapsed(true);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleSelectMission = useCallback((prompt: string) => {
    setRequest(prompt);
  }, []);

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
        <ResearchStudioSidebarLeft
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((v) => !v)}
        />

        <main className="rs3-main">
          <div className="rs3-main-scroll">
            <ResearchStudioHero
              request={request}
              onRequestChange={setRequest}
              onSelectMission={handleSelectMission}
            />
          </div>
        </main>

        <ResearchStudioSidebarRight
          collapsed={rightCollapsed}
          onToggleCollapse={() => setRightCollapsed((v) => !v)}
          providers={providers}
          loading={sourcesLoading}
          refreshing={refreshing}
          error={sourcesError}
          onRefreshAll={() => void refreshAll()}
          onRefreshProvider={(id) => void refreshProvider(id)}
          onOpenDataSources={() => void handleOpenDataSources()}
        />
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
