"use client";

import { useMemo } from "react";
import {
  getProductAffinityForArchetype,
  loadBrandArchetypeCatalog,
  type BrandArchetype,
} from "@/lib/brand-archetypes";
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

  return (
    <div className="ps-archetype-cast">
      <div className="ps-section-label">
        <span>Brand Archetypes</span>
        <em>Official casting agency roles</em>
      </div>
      <p className="ps-muted ps-archetype-lead">
        Persona Studio casts official Brand Archetypes — not random attractive people.
      </p>
      <div className="ps-archetype-grid">
        {archetypes.map((archetype) => (
          <ArchetypeCard key={archetype.id} archetype={archetype} />
        ))}
      </div>
    </div>
  );
}
