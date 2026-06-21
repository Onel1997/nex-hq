"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommerceLabPayload } from "@/lib/commerce/commerce-lab-types";

interface CommerceLabState {
  data: CommerceLabPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCommerceLab(): CommerceLabState {
  const [data, setData] = useState<CommerceLabPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/commerce/lab");
      const body = (await response.json()) as CommerceLabPayload & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load Commerce Lab");
      }

      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Commerce Lab");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
