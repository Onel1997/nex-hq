"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import {
  AGENT_WORKSPACE_ROUTES,
  AGENT_STUDIO_NAMES,
  COMMERCE_LAB_ROUTE,
} from "@/lib/workspace/agent-routes";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Crown,
  Megaphone,
  Palette,
  PenLine,
  Search,
  ShoppingBag,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  content: PenLine,
  image: Wand2,
  marketing: Megaphone,
  shopify: ShoppingBag,
};

const COMMERCE_LAB_COLOR = "#F97316";

export type WorkspaceNavActiveId = AgentId | "commerce";

interface WorkspaceNavProps {
  activeId: WorkspaceNavActiveId;
}

export function WorkspaceNav({ activeId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const commerceActive =
    activeId === "commerce" || pathname === COMMERCE_LAB_ROUTE;

  return (
    <nav className="workspace-nav" aria-label="Agent workspaces">
      <div className="workspace-nav-header">
        <span className="workspace-nav-label">Departments</span>
      </div>

      <ul className="workspace-nav-list">
        {AGENT_IDS.map((id) => {
          const Icon = AGENT_ICONS[id];
          const href = AGENT_WORKSPACE_ROUTES[id];
          const active = id === activeId || pathname === href;
          const color = getAgentColor(id);

          return (
            <li key={id}>
              <Link
                href={href}
                className={cn(
                  "workspace-nav-item",
                  active && "workspace-nav-item-active",
                )}
                style={
                  active
                    ? ({ "--workspace-accent": color } as React.CSSProperties)
                    : undefined
                }
              >
                <span
                  className="workspace-nav-icon-wrap"
                  style={{ color: active ? color : undefined }}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="workspace-nav-text">
                  <span className="workspace-nav-name">
                    {AGENT_STUDIO_NAMES[id]}
                  </span>
                </span>
                {active ? (
                  <span className="workspace-nav-active-bar" aria-hidden />
                ) : null}
              </Link>
            </li>
          );
        })}

        <li>
          <Link
            href={COMMERCE_LAB_ROUTE}
            className={cn(
              "workspace-nav-item",
              commerceActive && "workspace-nav-item-active",
            )}
            style={
              commerceActive
                ? ({ "--workspace-accent": COMMERCE_LAB_COLOR } as React.CSSProperties)
                : undefined
            }
          >
            <span
              className="workspace-nav-icon-wrap"
              style={{ color: commerceActive ? COMMERCE_LAB_COLOR : undefined }}
            >
              <BarChart3 className="size-4" strokeWidth={1.75} />
            </span>
            <span className="workspace-nav-text">
              <span className="workspace-nav-name">Commerce Lab</span>
            </span>
            {commerceActive ? (
              <span className="workspace-nav-active-bar" aria-hidden />
            ) : null}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
