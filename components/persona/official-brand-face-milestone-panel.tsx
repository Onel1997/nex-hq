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
      <span>{approvedCount}/{requiredCount} freigegeben</span>
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
        <span>Offizielle Markengesichter</span>
        <em>Dauerhafte Persona-Autorität</em>
      </div>
      <p className="ps-muted ps-obf-lead">
        Nur ausdrücklich dauerhafte Brand-Cast-Freigaben zählen für diesen Meilenstein.
      </p>
      {!progress ? (
        <p className="ps-muted">Dauerhafter Brand-Cast-Stand wird geladen…</p>
      ) : (
        <>
          <ul className="ps-obf-list" aria-label="Brand-Cast-Meilenstein">
            <MilestoneRow name="Männliche Markenmodels" approvedCount={progress.male_approved} requiredCount={progress.male_required} />
            <MilestoneRow name="Weibliche Markenmodels" approvedCount={progress.female_approved} requiredCount={progress.female_required} />
          </ul>
          <div
            className={`ps-obf-overall${progress.milestone_reached ? " is-done" : ""}`}
            aria-label={`${approvedCount}/${requiredCount} dauerhafte Brand-Cast-Freigaben`}
          >
            <em>Gesamt</em>
            <strong>{approvedCount}/{requiredCount} offizielle Milaene-Markenmodels</strong>
          </div>
          <p className="ps-muted ps-obf-hint">
            Video-Freigabe ist unabhängig und für die Brand-Cast-Mitgliedschaft nicht erforderlich.
          </p>
        </>
      )}
    </div>
  );
}
