/** Truncate text to a max character length, preserving word boundaries when possible. */
export function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const slice = trimmed.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;

  return `${cut}…`;
}

/** Format a string list as bullet points, optionally truncating each item. */
export function formatBulletList(
  items: string[],
  options?: { maxItems?: number; maxItemChars?: number },
): string {
  const maxItems = options?.maxItems ?? items.length;
  const maxItemChars = options?.maxItemChars ?? 280;

  return items
    .slice(0, maxItems)
    .map((item) => `  - ${truncateText(item, maxItemChars)}`)
    .join("\n");
}
