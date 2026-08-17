export const ARTWORK_FILE_INPUT_ACCEPT =
  ".svg,.png,.pdf,.ai,.eps,image/svg+xml,image/png,application/pdf";

export function triggerArtworkFilePicker(
  input: HTMLInputElement | null | undefined,
): boolean {
  if (!input) return false;
  input.click();
  return true;
}
