type ClipboardWriter = { writeText(value: string): Promise<void> };

export type UgcClipboardDependencies = {
  clipboard?: ClipboardWriter | null;
  document?: Document | null;
};

/** Copy only the exact prompt body, with an iOS-compatible DOM fallback. */
export async function copyUgcPromptText(
  prompt: string,
  dependencies: UgcClipboardDependencies = {},
): Promise<boolean> {
  const clipboard = dependencies.clipboard === undefined
    ? globalThis.navigator?.clipboard
    : dependencies.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(prompt);
      return true;
    } catch {
      // Safari can reject the async API even after a direct user gesture.
    }
  }

  const documentAuthority = dependencies.document === undefined
    ? globalThis.document
    : dependencies.document;
  if (!documentAuthority?.body || typeof documentAuthority.execCommand !== "function") {
    return false;
  }

  const textarea = documentAuthority.createElement("textarea");
  textarea.value = prompt;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "-9999px auto auto -9999px";
  textarea.style.opacity = "0";
  documentAuthority.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return documentAuthority.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
