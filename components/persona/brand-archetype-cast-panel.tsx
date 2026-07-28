"use client";

import { useMemo } from "react";
import {
  getIdentityDnaForArchetype,
  getProductAffinityForArchetype,
  loadBrandArchetypeCatalog,
  type BrandArchetype,
} from "@/lib/brand-archetypes";
import {
  getActiveBrandFaceForArchetype,
  getOfficialBrandFaceMilestone,
  summarizeIdentityDna,
} from "@/lib/brand-face-selection";
import { loadProductCatalog } from "@/lib/product-intelligence";

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

function ArchetypeCard({ archetype }: { archetype: BrandArchetype }) {
  const catalog = useMemo(() => loadProductCatalog(), []);
  const affinity = useMemo(
    () => getProductAffinityForArchetype(archetype, catalog),
    [archetype, catalog],
  );
  const archetypeCatalog = useMemo(() => loadBrandArchetypeCatalog(), []);
  const dna = useMemo(
    () => getIdentityDnaForArchetype(archetypeCatalog, archetype),
    [archetype, archetypeCatalog],
  );
  const dnaSummary = useMemo(() => summarizeIdentityDna(dna), [dna]);
  const activeFace = useMemo(
    () => getActiveBrandFaceForArchetype(archetype.workspaceId, archetype.id),
    [archetype.id, archetype.workspaceId],
  );

  return (
    <article className="ps-archetype-card">
      <header className="ps-archetype-card-head">
        <strong>{archetype.name}</strong>
        <em>{archetype.commercialRole}</em>
      </header>
      <p className="ps-muted ps-archetype-purpose">
        Purpose: {archetype.purpose.join(" · ")}
      </p>
      <p className="ps-archetype-platforms">
        Best platforms: {archetype.bestPlatforms.join(", ")}
      </p>
      <p className="ps-archetype-campaign">{archetype.campaignRole}</p>
      <p className="ps-archetype-dna">
        Identity DNA: {dnaSummary.skinToneFamily.split(",")[0]} ·{" "}
        {dnaSummary.hairFamily.split(",")[0]}
      </p>
      <p className={`ps-archetype-face-status${activeFace ? " is-approved" : ""}`}>
        {activeFace
          ? `Brand Face approved · v${activeFace.version}`
          : "0/1 Brand Face approved"}
      </p>
      <ul className="ps-archetype-products">
        {affinity.slice(0, 3).map((a) => (
          <li key={`${a.productType}-${a.rating}`}>
            <span aria-hidden>{stars(a.rating)}</span> {a.productType}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Official Brand Archetype cast — replaces random candidate labels.
 */
export function BrandArchetypeCastPanel() {
  const catalog = useMemo(() => loadBrandArchetypeCatalog(), []);
  const archetypes = catalog.archetypes.filter((a) => a.status === "active");
  const milestone = useMemo(
    () => getOfficialBrandFaceMilestone(catalog.workspaceId),
    [catalog.workspaceId],
  );

  return (
    <div className="ps-archetype-cast">
      <div className="ps-section-label">
        <span>Brand Archetypes</span>
        <em>Official casting agency roles</em>
      </div>
      <p className="ps-muted ps-archetype-lead">
        Persona Studio casts official Brand Archetypes — not random attractive people.
        {" "}
        Progress: {milestone.approvedCount}/{milestone.requiredCount} Official
        Brand Faces.
      </p>
      <div className="ps-archetype-grid">
        {archetypes.map((archetype) => (
          <ArchetypeCard key={archetype.id} archetype={archetype} />
        ))}
      </div>
    </div>
  );
}
