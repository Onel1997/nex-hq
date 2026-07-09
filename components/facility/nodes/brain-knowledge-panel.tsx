"use client";

import type { BrainKnowledgeBase } from "@/lib/facility/types";
import { memo } from "react";

interface BrainKnowledgePanelProps {
  knowledge: BrainKnowledgeBase;
}

const ENTRIES: {
  key: keyof BrainKnowledgeBase;
  label: string;
}[] = [
  { key: "reports", label: "Reports" },
  { key: "designs", label: "Designs" },
  { key: "campaigns", label: "Campaigns" },
  { key: "collections", label: "Collections" },
  { key: "activeAgents", label: "Active Agents" },
];

export const BrainKnowledgePanel = memo(function BrainKnowledgePanel({
  knowledge,
}: BrainKnowledgePanelProps) {
  return (
    <div className="facility-brain-knowledge">
      <p className="facility-brain-knowledge-title">Knowledge Base</p>
      <ul className="facility-brain-knowledge-grid">
        {ENTRIES.map(({ key, label }) => (
          <li key={key} className="facility-brain-knowledge-item">
            <span className="facility-brain-knowledge-value">
              {knowledge[key].toLocaleString()}
            </span>
            <span className="facility-brain-knowledge-label">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
