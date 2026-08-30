"use client";

import { MockModeBadge } from "@/components/design/mock-mode-badge";
import { useStudioMockMode } from "@/hooks/use-studio-mock-mode";
import { buildMockDesignMission } from "@/lib/design/studio-mock-data";
import {
  buildDesignMissionFromHandoff,
  useDesignMission,
} from "@/lib/design/design-mission-store";
import {
  loadFusionCreativeBriefHandoff,
} from "@/lib/research-intelligence/creative-brief/handoff-store";
import {
  buildDesignStudioBriefFromFusion,
} from "@/lib/research-intelligence/creative-brief/fusion-handoff";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Home, Palette, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { MasterArtworkWorkspace } from "@/components/design/v2/master-artwork-workspace";

export function DesignStudioCenter() {
  const { mission, hydrated, patchMission, setMission } = useDesignMission();
  const { mockMode, probing } = useStudioMockMode();

  useEffect(() => {
    if (!hydrated || mission) return;
    const pending = loadFusionCreativeBriefHandoff();
    if (!pending?.brief) return;
    const studioBrief = buildDesignStudioBriefFromFusion(pending.brief);
    const reportId = `fusion-${pending.brief.generatedAt}`;
    setMission(
      buildDesignMissionFromHandoff({
        reportId,
        reportTitle: pending.brief.conceptName,
        collectionName: pending.brief.conceptName,
        intelligenceContext: {
          sourceType: "research-studio-fusion",
          sourceReportId: reportId,
          reportTitle: pending.brief.conceptName,
          executiveSummary: pending.brief.executiveSummary,
          keyFindings: pending.brief.researchEvidence,
          recommendations: [pending.brief.nextStep],
          connectedDepartments: ["research", "design"],
          productName: pending.brief.recommendedProduct,
          collectionName: pending.brief.conceptName,
        },
        brief: studioBrief,
      }),
    );
  }, [hydrated, mission, setMission]);

  const startDemoMission = () => {
    setMission(buildMockDesignMission());
  };

  return (
    <WorkspaceShell
      agentId="designer"
      className="design-studio-shell"
      hideHeader
    >
      <div className="design-studio design-studio-lab nx-studio">
        <header className="design-studio-topbar design-studio-topbar-lab">
          <nav className="design-studio-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/" className="design-studio-crumb">
              <Home className="size-3.5" />
              Xeriamo
            </Link>
            <ChevronRight className="size-3.5 design-studio-crumb-sep" aria-hidden />
            <span className="design-studio-crumb design-studio-crumb-current">
              <Palette className="size-3.5" />
              Design Studio · Artwork-Bibliothek
            </span>
          </nav>

          <div className="design-studio-topbar-meta">
            <span className="dsv2-topbar-subtitle">Freigegebene Artworks verwalten</span>
            <MockModeBadge active={mockMode} probing={probing} />
            {!mission && mockMode ? (
              <button
                type="button"
                className="dsv2-demo-btn"
                onClick={startDemoMission}
              >
                Demo-Artwork laden
              </button>
            ) : null}
            <Link href="/agents/research" className="dsv2-reports-link">
              Berichte
            </Link>
            <button
              type="button"
              className="design-studio-refresh design-studio-refresh-subtle"
              onClick={() => window.location.reload()}
              title="Arbeitsbereich aktualisieren"
              aria-label="Arbeitsbereich aktualisieren"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </header>

        <div className="design-studio-body design-studio-body-workspace">
          {!hydrated ? (
            <div className="nx-loading" role="status" aria-live="polite"><span className="nx-spinner" /><strong>Artwork-Bibliothek wird geladen…</strong></div>
          ) : (
            <MasterArtworkWorkspace mission={mission ?? undefined} onPatchMission={mission ? patchMission : undefined} />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
