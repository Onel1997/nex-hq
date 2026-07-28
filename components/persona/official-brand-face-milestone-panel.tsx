"use client";

import { useMemo } from "react";
import {
  formatMilestoneLines,
  getOfficialBrandFaceMilestone,
  type OfficialBrandFaceMilestone,
} from "@/lib/brand-face-selection";

function MilestoneRow({
  name,
  approvedCount,
  requiredCount,
}: {
  name: string;
  approvedCount: number;
  requiredCount: number;
}) {
  const done = approvedCount >= requiredCount;
  return (
    <li className={`ps-obf-row${done ? " is-done" : ""}`}>
      <strong>{name}</strong>
      <span>
        {approvedCount}/{requiredCount} approved
      </span>
    </li>
  );
}

/**
 * Official Milaene Brand Face milestone — 3 archetypes, 0/3 until all approved.
 */
export function OfficialBrandFaceMilestonePanel({
  workspaceId = "ws-milaene",
  milestone: milestoneProp,
}: {
  workspaceId?: string;
  milestone?: OfficialBrandFaceMilestone;
}) {
  const milestone = useMemo(
    () => milestoneProp ?? getOfficialBrandFaceMilestone(workspaceId),
    [milestoneProp, workspaceId],
  );

  const lines = useMemo(() => formatMilestoneLines(milestone), [milestone]);

  return (
    <div className="ps-obf-milestone">
      <div className="ps-section-label">
        <span>Official Brand Faces</span>
        <em>Phase 1.8 selection</em>
      </div>
      <p className="ps-muted ps-obf-lead">
        Select and approve exactly three long-term Milaene Brand Faces — one per
        archetype. Persona Studio is complete only when all three are approved.
      </p>
      <ul className="ps-obf-list" aria-label="Brand Face milestone">
        {milestone.archetypes.map((row) => (
          <MilestoneRow
            key={row.archetypeId}
            name={row.archetypeName}
            approvedCount={row.approvedCount}
            requiredCount={row.requiredCount}
          />
        ))}
      </ul>
      <div
        className={`ps-obf-overall${milestone.complete ? " is-done" : ""}`}
        aria-label={lines[lines.length - 1]}
      >
        <em>Overall</em>
        <strong>
          {milestone.approvedCount}/{milestone.requiredCount} Official Milaene
          Brand Faces
        </strong>
      </div>
      {!milestone.complete ? (
        <p className="ps-muted ps-obf-hint">
          Image Studio and Video Studio stay dark until this cast is complete.
        </p>
      ) : (
        <p className="ps-obf-complete">All three Official Brand Faces are approved.</p>
      )}
    </div>
  );
}
