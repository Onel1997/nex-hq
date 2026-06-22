"use client";

import { StudioSectionGrid } from "@/components/workspace/studio-section";
import { AGENT_STUDIO_SECTIONS } from "@/lib/workspace/agent-routes";
import type { ReactNode } from "react";

interface AgentStudioProps {
  agentId: keyof typeof AGENT_STUDIO_SECTIONS;
  header?: ReactNode;
  children?: ReactNode;
  hideSections?: boolean;
}

/** Renders configured studio sections with placeholder grids. */
export function AgentStudio({
  agentId,
  header,
  children,
  hideSections = false,
}: AgentStudioProps) {
  const sections = AGENT_STUDIO_SECTIONS[agentId];

  return (
    <div className="workspace-studio">
      {header ? <div className="workspace-studio-header">{header}</div> : null}
      {children}
      {!hideSections ? (
        <div className="workspace-studio-sections">
          {sections.map((section) => (
            <StudioSectionGrid key={section.id} section={section} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
