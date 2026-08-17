"use client";

import type { BrandCastMilestoneProgress } from "@/lib/persona";

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
      <span>{approvedCount}/{requiredCount} approved</span>
    </li>
  );
}

/** Durable Persona-backed Brand Cast progress. Never reads the process-local registry. */
export function OfficialBrandFaceMilestonePanel({
  progress,
}: {
  progress: BrandCastMilestoneProgress | null;
}) {
  const approvedCount = progress
    ? progress.male_approved + progress.female_approved
    : 0;
  const requiredCount = progress
    ? progress.male_required + progress.female_required
    : 0;

  return (
    <div className="ps-obf-milestone">
      <div className="ps-section-label">
        <span>Official Brand Faces</span>
        <em>Durable Persona authority</em>
      </div>
      <p className="ps-muted ps-obf-lead">
        Only explicit durable Brand Cast approvals count toward this milestone.
      </p>
      {!progress ? (
        <p className="ps-muted">Loading durable Brand Cast progress…</p>
      ) : (
        <>
          <ul className="ps-obf-list" aria-label="Brand Cast milestone">
            <MilestoneRow name="Male Brand Models" approvedCount={progress.male_approved} requiredCount={progress.male_required} />
            <MilestoneRow name="Female Brand Models" approvedCount={progress.female_approved} requiredCount={progress.female_required} />
          </ul>
          <div
            className={`ps-obf-overall${progress.milestone_reached ? " is-done" : ""}`}
            aria-label={`${approvedCount}/${requiredCount} durable Brand Cast approvals`}
          >
            <em>Overall</em>
            <strong>{approvedCount}/{requiredCount} Official Milaene Brand Models</strong>
          </div>
          <p className="ps-muted ps-obf-hint">
            Video approval is independent and is not required for Brand Cast membership.
          </p>
        </>
      )}
    </div>
  );
}
