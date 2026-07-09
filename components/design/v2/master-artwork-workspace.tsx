"use client";

import { ArtworkPreviewStage } from "@/components/design/v2/center/artwork-preview-stage";
import { ArtworkUploadZone } from "@/components/design/v2/center/artwork-upload-zone";
import { ArtworkInspector } from "@/components/design/v2/inspector/artwork-inspector";
import {
  ArtworkSidebar,
  SidebarSectionPanel,
} from "@/components/design/v2/sidebar/artwork-sidebar";
import { ArtworkWorkflowRail } from "@/components/design/v2/workflow/artwork-workflow-rail";
import { useArtworkWorkspace } from "@/components/design/v2/use-artwork-workspace";
import { usePersistedCollapse } from "@/hooks/use-persisted-collapse";
import type { DesignMissionState } from "@/lib/design/design-mission-store";
import { cn } from "@/lib/utils";

interface MasterArtworkWorkspaceProps {
  mission?: DesignMissionState;
  onPatchMission?: (updater: (state: DesignMissionState) => DesignMissionState) => void;
  className?: string;
}

export function MasterArtworkWorkspace({
  mission,
  className,
}: MasterArtworkWorkspaceProps) {
  const workspace = useArtworkWorkspace({ mission });
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = usePersistedCollapse(
    "dsv2-sidebar-collapsed",
    false,
  );
  const { collapsed: inspectorCollapsed, setCollapsed: setInspectorCollapsed } = usePersistedCollapse(
    "dsv2-inspector-collapsed",
    false,
  );

  return (
    <div className={cn("dsv2-root", className)}>
      <div className="dsv2-workspace">
        <ArtworkSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          activeSection={workspace.activeSidebarSection}
          onSectionChange={workspace.setActiveSidebarSection}
          versionCount={workspace.versionHistory.length}
          recentCount={workspace.recentUploads.length}
        >
          <SidebarSectionPanel
            section={workspace.activeSidebarSection}
            versionHistory={workspace.versionHistory}
            recentUploads={workspace.recentUploads}
          />
        </ArtworkSidebar>

        <main className="dsv2-center" aria-label="Master artwork canvas">
          {workspace.hasArtwork && workspace.preview ? (
            <ArtworkPreviewStage
              preview={workspace.preview}
              fileName={workspace.localUpload?.fileName ?? mission?.brief.title}
              validationStatus={workspace.validation.status}
              uploadError={workspace.uploadError}
              onReplace={workspace.openFilePicker}
            />
          ) : (
            <ArtworkUploadZone
              onFileSelect={workspace.handleFileSelect}
              onOpenPicker={workspace.openFilePicker}
              fileInputRef={workspace.fileInputRef}
              error={workspace.uploadError}
            />
          )}
        </main>

        <ArtworkInspector
          collapsed={inspectorCollapsed}
          onCollapsedChange={setInspectorCollapsed}
          preview={workspace.preview}
          validation={workspace.validation}
          analysis={workspace.analysis}
          missionView={workspace.missionView}
          canApprove={workspace.canApprove}
          isApproved={workspace.isApproved}
          onApprove={workspace.approveArtwork}
        />
      </div>

      <ArtworkWorkflowRail activeStep={workspace.workflowStep} />
    </div>
  );
}
