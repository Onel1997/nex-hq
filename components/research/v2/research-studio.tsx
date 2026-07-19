"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useResearchBrain } from "@/components/research/use-research-brain";
import { useWorkspaceContext } from "@/components/workspace/use-workspace-context";
import { useWorkspace } from "@/lib/i18n";
import { ResearchStudioCenter } from "./research-studio-center";
import { ResearchStudioSidebarLeft } from "./research-studio-sidebar-left";
import { ResearchStudioSidebarRight } from "./research-studio-sidebar-right";
import { useResearchStudio } from "./use-research-studio";
import { ChevronRight, Home } from "lucide-react";

const MOBILE_BREAKPOINT = 1024;

export function ResearchStudio() {
  const workspace = useWorkspace();
  const { data, loading: contextLoading } = useWorkspaceContext("research");
  const { snapshot, loading: brainLoading } = useResearchBrain();
  const studio = useResearchStudio();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

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

  const handleSelectMission = useCallback(
    (prompt: string) => {
      studio.setRequest(prompt);
      void studio.runResearch(prompt);
    },
    [studio],
  );

  return (
    <div className="research-studio">
      <header className="research-studio-topbar">
        <nav className="research-studio-breadcrumb" aria-label="Breadcrumb">
          <Link href="/" className="research-studio-breadcrumb-link">
            <Home className="size-3.5" />
            <span>NexHQ</span>
          </Link>
          <ChevronRight className="size-3.5 opacity-40" aria-hidden />
          <span className="research-studio-breadcrumb-current">
            Research Studio
          </span>
        </nav>
        <span className="research-studio-workspace">{workspace.name}</span>
      </header>

      <div className="research-studio-body">
        <ResearchStudioSidebarLeft
          data={data}
          loading={contextLoading}
          recentMissions={studio.recentMissions}
          pinnedIds={studio.pinnedIds}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((v) => !v)}
          onSelectMission={handleSelectMission}
        />

        <ResearchStudioCenter
          request={studio.request}
          onRequestChange={studio.setRequest}
          onRun={studio.runResearch}
          isLoading={studio.isLoading}
          error={studio.error}
          phase={studio.phase}
          result={studio.result}
          onReset={studio.reset}
        />

        <ResearchStudioSidebarRight
          snapshot={snapshot}
          loading={brainLoading}
          collapsed={rightCollapsed}
          onToggleCollapse={() => setRightCollapsed((v) => !v)}
        />
      </div>
    </div>
  );
}
