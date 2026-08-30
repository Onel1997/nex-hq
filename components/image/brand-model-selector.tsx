"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandModelSummary } from "@/lib/persona/domain/brand-model-contract";
import {
  fetchImageBrandModelSelection,
  fetchImageEligibleBrandModels,
  type ImageBrandModelSelection,
} from "@/lib/image/brand-model-production-context";
import { loadCachedOwnerData } from "@/lib/image/client-owner-data-cache";

export function BrandModelSelector({
  onSelectionChange,
}: {
  onSelectionChange: (selection: ImageBrandModelSelection | null) => void;
}) {
  const [models, setModels] = useState<BrandModelSummary[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const selectionRequestRef = useRef(0);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const eligible = await loadCachedOwnerData({
          key: "image:eligible-brand-models-v1",
          ttlMs: 30_000,
          load: fetchImageEligibleBrandModels,
        });
        if (cancelled) return;
        setModels(eligible);
        const receivedPersonaId = new URLSearchParams(window.location.search).get(
          "brandModel",
        );
        const initialPersonaId =
          receivedPersonaId &&
          eligible.some((model) => model.personaId === receivedPersonaId)
            ? receivedPersonaId
            : eligible.length === 1
              ? eligible[0].personaId
              : null;
        if (initialPersonaId) {
          setSelectedPersonaId(initialPersonaId);
          const selection = await fetchImageBrandModelSelection(initialPersonaId);
          if (!cancelled) onSelectionChangeRef.current(selection);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Freigegebene Markenmodels konnten nicht geladen werden.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectPersona(personaId: string) {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setSelectedPersonaId(personaId);
    setError(null);
    if (!personaId) {
      onSelectionChangeRef.current(null);
      return;
    }
    setLoading(true);
    try {
      const selection = await fetchImageBrandModelSelection(personaId);
      if (selectionRequestRef.current !== requestId) return;
      onSelectionChangeRef.current(selection);
    } catch (cause) {
      if (selectionRequestRef.current !== requestId) return;
      onSelectionChangeRef.current(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Das Markenmodel konnte nicht für die Produktion geladen werden.",
      );
    } finally {
      if (selectionRequestRef.current === requestId) setLoading(false);
    }
  }

  const selected = models.find(
    (model) => model.personaId === selectedPersonaId,
  );

  return (
    <div className="is-owner-selector">
      <label className="is-field-label" htmlFor="image-brand-model">
        Markenmodel
      </label>
      <select
        id="image-brand-model"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        value={selectedPersonaId}
        disabled={loading}
        onChange={(event) => void selectPersona(event.target.value)}
      >
        <option value="">Kein Markenmodel ausgewählt</option>
        {models.map((model) => (
          <option key={model.brandModelId} value={model.personaId}>
            {model.displayName}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="is-brand-model-selected"><span className="is-brand-model-avatar">{selected.displayName.slice(0, 1).toLocaleUpperCase("de-DE")}</span><div><strong>{selected.displayName}</strong><span>Für Bilder freigegeben · Identität festgeschrieben</span></div></div>
      ) : null}
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {selected ? <details className="nx-technical"><summary>Technische Details</summary><div className="nx-technical__body">Identity Lock v{selected.identityLockVersion} · {selected.identityLockSnapshotId.slice(0, 8)}</div></details> : null}
    </div>
  );
}
