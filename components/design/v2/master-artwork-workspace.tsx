"use client";

import { ArtworkPreviewStage } from "@/components/design/v2/center/artwork-preview-stage";
import { ArtworkUploadZone } from "@/components/design/v2/center/artwork-upload-zone";
import { ArtworkInspector } from "@/components/design/v2/inspector/artwork-inspector";
import { SidebarSectionPanel } from "@/components/design/v2/sidebar/artwork-sidebar";
import { ArtworkWorkflowRail } from "@/components/design/v2/workflow/artwork-workflow-rail";
import { useArtworkWorkspace } from "@/components/design/v2/use-artwork-workspace";
import type { SidebarSectionId } from "@/components/design/v2/types";
import { usePersistedCollapse } from "@/hooks/use-persisted-collapse";
import type { DesignMissionState } from "@/lib/design/design-mission-store";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FolderOpen,
  History,
  Image,
  Layers,
  Upload,
} from "lucide-react";

const SECTIONS: Array<{
  id: SidebarSectionId;
  label: string;
  icon: typeof Image;
  disabled?: boolean;
}> = [
  { id: "master-artwork", label: "Master Artwork", icon: Image },
  { id: "versions", label: "Versions", icon: Layers },
  { id: "collections", label: "Collections", icon: FolderOpen },
  { id: "brand-library", label: "Brand Library", icon: BookOpen, disabled: true },
  { id: "history", label: "History", icon: History },
  { id: "recent-uploads", label: "Recent Uploads", icon: Upload },
];

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
  const { collapsed: inspectorCollapsed, setCollapsed: setInspectorCollapsed } = usePersistedCollapse(
    "dsv2-inspector-collapsed",
    false,
  );

  const showArtworkStage = workspace.activeSidebarSection === "master-artwork";

  return (
    <div className={cn("dsv2-root", className)}>
      <div className="dsv2-workspace dsv2-workspace-single">
        <main className="dsv2-center" aria-label="Master artwork canvas">
          <div className="dsv2-section-tabs" role="tablist" aria-label="Workspace sections">
            {SECTIONS.map(({ id, label, icon: Icon, disabled }) => {
              const count =
                id === "versions"
                  ? workspace.versionHistory.length
                  : id === "recent-uploads"
                    ? workspace.recentUploads.length
                    : undefined;

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={workspace.activeSidebarSection === id}
                  className={cn(
                    "dsv2-section-tab",
                    workspace.activeSidebarSection === id && "is-active",
                    disabled && "is-disabled",
                  )}
                  onClick={() => !disabled && workspace.setActiveSidebarSection(id)}
                  disabled={disabled}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span>{label}</span>
                  {count != null && count > 0 ? (
                    <span className="dsv2-section-tab-badge">{count}</span>
                  ) : null}
                  {disabled ? <span className="dsv2-section-tab-soon">Soon</span> : null}
                </button>
              );
            })}
          </div>

          {showArtworkStage ? (
            workspace.hasArtwork && workspace.preview ? (
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
            )
          ) : (
            <div className="dsv2-section-panel">
              <SidebarSectionPanel
                section={workspace.activeSidebarSection}
                versionHistory={workspace.versionHistory}
                recentUploads={workspace.recentUploads}
              />
            </div>
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
