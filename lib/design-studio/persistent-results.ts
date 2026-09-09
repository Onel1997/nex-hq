import type { DesignResult, DesignRun } from "@/lib/design-studio/contracts";

export function isSuccessfulDesignRun(run: DesignRun): boolean {
  return (run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED")
    && run.results.length > 0;
}

export function latestCompletedDesignRun(runs: DesignRun[]): DesignRun | null {
  return runs.find(isSuccessfulDesignRun) ?? null;
}

export function latestDesignRun(runs: DesignRun[]): DesignRun | null {
  return runs[0] ?? null;
}

function isTerminalDesignRun(run: DesignRun): boolean {
  return run.status === "SUCCEEDED"
    || run.status === "PARTIALLY_SUCCEEDED"
    || run.status === "FAILED";
}

/** Keep a durable terminal result when a delayed browser observation arrives. */
export function mergeObservedDesignRun(
  current: DesignRun | null,
  observed: DesignRun,
): DesignRun {
  if (!current || current.id !== observed.id) return observed;
  if (
    (isSuccessfulDesignRun(current) && !isSuccessfulDesignRun(observed))
    || (isTerminalDesignRun(current) && !isTerminalDesignRun(observed))
  ) {
    return current;
  }
  return {
    ...observed,
    results: mergeDurableDesignResults(observed.results, current.results),
  };
}

export function mergeDurableDesignResults(
  immediateDerived: DesignResult[],
  persistent: DesignResult[],
): DesignResult[] {
  const seen = new Set<string>();
  return [...immediateDerived, ...persistent].filter((result) => {
    const key = result.libraryAssetId ?? result.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
