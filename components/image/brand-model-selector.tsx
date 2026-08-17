"use client";

import { useEffect, useState } from "react";
import type { BrandModelSummary } from "@/lib/persona/domain/brand-model-contract";
import {
  fetchImageBrandModelSelection,
  fetchImageEligibleBrandModels,
  type ImageBrandModelSelection,
} from "@/lib/image/brand-model-production-context";

export function BrandModelSelector({
  onSelectionChange,
}: {
  onSelectionChange: (selection: ImageBrandModelSelection | null) => void;
}) {
  const [models, setModels] = useState<BrandModelSummary[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const eligible = await fetchImageEligibleBrandModels();
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
          if (!cancelled) onSelectionChange(selection);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Eligible Brand Models could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onSelectionChange]);

  async function selectPersona(personaId: string) {
    setSelectedPersonaId(personaId);
    setError(null);
    if (!personaId) {
      onSelectionChange(null);
      return;
    }
    setLoading(true);
    try {
      onSelectionChange(await fetchImageBrandModelSelection(personaId));
    } catch (cause) {
      onSelectionChange(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Brand Model handoff could not be resolved.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selected = models.find(
    (model) => model.personaId === selectedPersonaId,
  );

  return (
    <div className="space-y-2">
      <label className="is-field-label" htmlFor="image-brand-model">
        Persona Brand Model
      </label>
      <select
        id="image-brand-model"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        value={selectedPersonaId}
        disabled={loading}
        onChange={(event) => void selectPersona(event.target.value)}
      >
        <option value="">No Persona selected</option>
        {models.map((model) => (
          <option key={model.brandModelId} value={model.personaId}>
            {model.displayName} · Lock v{model.identityLockVersion}
          </option>
        ))}
      </select>
      {selected ? (
        <p className="text-[11px] text-muted-foreground">
          Persona authority · {selected.identityLockSnapshotId.slice(0, 8)} · v
          {selected.identityLockVersion}
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
