import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { copyPromptText } from "@/lib/xeriano/clipboard";

test("shared prompt clipboard copies the exact prompt and nothing else", async () => {
  const writes: string[] = [];
  const prompt = "Exakter Prompt mit Umlaut und Zeilenumbruch\nZeile 2";
  assert.equal(await copyPromptText(prompt, {
    clipboard: { async writeText(value) { writes.push(value); } },
    document: null,
  }), true);
  assert.deepEqual(writes, [prompt]);
});

test("Creative Prompt Library copy no longer creates or mutates a saved entry", () => {
  const library = readFileSync("components/creative-studio/creative-studio-library.tsx", "utf8");
  const workspace = readFileSync("components/creative-studio/creative-studio-workspace.tsx", "utf8");
  assert.match(library, /aria-label="Prompt kopieren"/);
  assert.match(library, /Prompt wurde kopiert\./);
  assert.match(library, /Prompt konnte nicht kopiert werden\./);
  assert.match(workspace, /onCopy=\{\(saved\) => copyPromptText\(saved\.prompt\)\}/);
  assert.doesNotMatch(library, /onDuplicate|Prompt duplizieren/);
  assert.doesNotMatch(workspace, /title: `\$\{saved\.title\} – Kopie`/);
});

test("Creative Prompt Library load, edit, favorite and delete actions remain separate", () => {
  const library = readFileSync("components/creative-studio/creative-studio-library.tsx", "utf8");
  assert.match(library, /props\.onLoad\(prompt\)/);
  assert.match(library, /props\.onEdit\(prompt\)/);
  assert.match(library, /props\.onToggleFavorite\(prompt\)/);
  assert.match(library, /props\.onDelete\(prompt\.id\)/);
});
