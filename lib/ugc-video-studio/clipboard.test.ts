import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { copyUgcPromptText } from "@/lib/ugc-video-studio/clipboard";

test("Prompt Library copy writes the exact prompt body and no title or metadata", async () => {
  const writes: string[] = [];
  const body = "Replace only the main person and preserve the source scene.";
  const copied = await copyUgcPromptText(body, {
    clipboard: { async writeText(value) { writes.push(value); } },
    document: null,
  });
  assert.equal(copied, true);
  assert.deepEqual(writes, [body]);
  assert.doesNotMatch(writes[0]!, /Test|Kling|duration|modelId/);
});

test("iOS clipboard fallback is invisible, exact and cleaned up", async () => {
  const events: string[] = [];
  const textarea = {
    value: "",
    style: {} as CSSStyleDeclaration,
    setAttribute(name: string, value: string) { events.push(`attribute:${name}:${value}`); },
    focus() { events.push("focus"); },
    select() { events.push("select"); },
    setSelectionRange(start: number, end: number) { events.push(`range:${start}:${end}`); },
    remove() { events.push("remove"); },
  };
  const documentAuthority = {
    body: { appendChild(value: unknown) { assert.equal(value, textarea); events.push("append"); } },
    createElement(name: string) { assert.equal(name, "textarea"); return textarea; },
    execCommand(command: string) { events.push(command); return true; },
  } as unknown as Document;

  assert.equal(await copyUgcPromptText("Nur der Prompt", {
    clipboard: { async writeText() { throw new Error("not_allowed"); } },
    document: documentAuthority,
  }), true);
  assert.equal(textarea.value, "Nur der Prompt");
  assert.match(String(textarea.style.position), /fixed/);
  assert.deepEqual(events.slice(-2), ["copy", "remove"]);
});

test("clipboard failures return a safe false result without mutating text", async () => {
  const body = "Unveränderter Prompt";
  assert.equal(await copyUgcPromptText(body, {
    clipboard: { async writeText(value) { assert.equal(value, body); throw new Error("denied"); } },
    document: null,
  }), false);
});

test("Prompt Library copy is separate from load/edit/delete and performs no duplication", () => {
  const library = readFileSync("components/ugc-video-studio/ugc-video-studio-library.tsx", "utf8");
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  assert.match(library, /aria-label="Prompt kopieren"/);
  assert.match(library, /Prompt wurde kopiert\./);
  assert.match(library, /Prompt konnte nicht kopiert werden\./);
  assert.match(library, /aria-label="Setup laden"/);
  assert.match(library, /aria-label="Prompt bearbeiten"/);
  assert.match(library, /aria-label="Prompt löschen"/);
  assert.doesNotMatch(library, /onDuplicate|Duplizieren|– Kopie/);
  assert.doesNotMatch(workspace, /title: `\$\{saved\.title\} – Kopie`/);
  assert.match(workspace, /onCopy=\{\(saved\) => copyUgcPromptText\(saved\.prompt\)\}/);
});
