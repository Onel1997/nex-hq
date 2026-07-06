"use client";

import {
  DesignMissionEmptyState,
  DesignMissionPanel,
} from "@/components/design/design-mission-panel";
import { MockModeBadge } from "@/components/design/mock-mode-badge";
import { useStudioMockMode } from "@/hooks/use-studio-mock-mode";
import { buildMockDesignMission } from "@/lib/design/studio-mock-data";
import { useDesignMission } from "@/lib/design/design-mission-store";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Home, Palette, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function DesignStudioCenter() {
  const { mission, hydrated, patchMission, setMission } = useDesignMission();
  const { mockMode, probing } = useStudioMockMode();

  const startDemoMission = () => {
    setMission(buildMockDesignMission());
  };

  return (
    <WorkspaceShell
      agentId="designer"
      className="design-studio-shell"
      hideHeader
    >
      <div className="design-studio design-studio-lab">
        <header className="design-studio-topbar design-studio-topbar-lab">
          <nav className="design-studio-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/" className="design-studio-crumb">
              <Home className="size-3.5" />
              Facility
            </Link>
            <ChevronRight className="size-3.5 design-studio-crumb-sep" aria-hidden />
            <span className="design-studio-crumb design-studio-crumb-current">
              <Palette className="size-3.5" />
              Design Studio
            </span>
            {mission ? (
              <>
                <ChevronRight className="size-3.5 design-studio-crumb-sep" aria-hidden />
                <span className="design-studio-crumb design-studio-crumb-design">
                  {mission.reportTitle || mission.brief.title}
                </span>
              </>
            ) : null}
          </nav>

          <div className="design-studio-topbar-meta">
            <span className="dsv2-topbar-subtitle">Master Artwork Workspace</span>
            <MockModeBadge active={mockMode} probing={probing} />
            {!mission && mockMode ? (
              <button
                type="button"
                className="dsv2-demo-btn"
                onClick={startDemoMission}
              >
                Load demo artwork
              </button>
            ) : null}
            <Link href="/facility/reports" className="dsv2-reports-link">
              Reports
            </Link>
            <button
              type="button"
              className="design-studio-refresh design-studio-refresh-subtle"
              onClick={() => window.location.reload()}
              title="Refresh workspace"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </header>

        <div className="design-studio-body design-studio-body-workspace">
          {!hydrated ? (
            <DesignMissionEmptyState />
          ) : mission ? (
            <DesignMissionPanel mission={mission} onPatchMission={patchMission} />
          ) : (
            <DesignMissionEmptyState />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
