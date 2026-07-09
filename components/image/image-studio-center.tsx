"use client";

import { ImageStudioWorkspace } from "@/components/image/image-studio-workspace";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export function ImageStudioCenter() {
  return (
    <WorkspaceShell agentId="image" className="image-studio-shell" hideHeader>
      <ImageStudioWorkspace />
    </WorkspaceShell>
  );
}
