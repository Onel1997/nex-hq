/** Deterministic seed from brief fields — stable across runs. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seeded(seed: number, index: number): number {
  const x = Math.sin((seed + index) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function pick<T>(seed: number, index: number, items: readonly T[]): T {
  return items[Math.floor(seeded(seed, index) * items.length)]!;
}

export function range(seed: number, index: number, min: number, max: number): number {
  return min + seeded(seed, index) * (max - min);
}
