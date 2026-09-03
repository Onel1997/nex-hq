/**
 * Return a stable, contiguous Creative reference sequence without mutating the
 * caller's objects. The explicit order remains the primary sort authority;
 * the original array position is the deterministic tie-breaker for legacy
 * setups that accidentally contain duplicate or gapped order values.
 */
export function canonicalizeCreativeReferenceOrder<
  T extends { order: number },
>(references: readonly T[]): T[] {
  return references
    .map((reference, originalIndex) => ({ reference, originalIndex }))
    .sort(
      (left, right) =>
        left.reference.order - right.reference.order ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ reference }, order) => ({ ...reference, order }));
}
