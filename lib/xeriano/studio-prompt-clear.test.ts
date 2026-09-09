import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Design prompt clear changes only the current prompt", () => {
  const workspace = readFileSync("components/xeriano/customer-design-studio.tsx", "utf8");
  assert.match(workspace, /type="button" aria-label="Prompt leeren" onClick=\{\(\) => setSetup\(\(current\) => \(\{ \.\.\.current, prompt: "" \}\)\)\}/);
  const clear = workspace.match(/<button type="button" aria-label="Prompt leeren"[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.doesNotMatch(clear, /reference|model|run|submit|localStorage/);
});

test("Creative prompt and negative-prompt clear actions are explicit non-submit buttons", () => {
  const workspace = readFileSync("components/creative-studio/creative-studio-workspace.tsx", "utf8");
  const controls = readFileSync("components/creative-studio/creative-studio-controls.tsx", "utf8");
  assert.match(workspace, /\{prompt \? <button[\s\S]{0,100}type="button"[\s\S]{0,100}className="cs-prompt-clear"[\s\S]{0,100}aria-label="Prompt leeren"[\s\S]{0,100}setPrompt\(""\)/);
  assert.match(controls, /className="cs-inline-prompt-clear"[\s\S]{0,120}aria-label="Prompt leeren"[\s\S]{0,180}negativePrompt: ""/);
});

test("UGC prompt and negative-prompt clear actions preserve references, settings and runs", () => {
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  const controls = readFileSync("components/ugc-video-studio/ugc-video-studio-controls.tsx", "utf8");
  assert.match(workspace, /\{prompt \? <button type="button" aria-label="Prompt leeren" onClick=\{\(\) => setPrompt\(""\)\}>/);
  assert.match(controls, /className="uv-inline-prompt-clear" aria-label="Prompt leeren"[\s\S]{0,180}negativePrompt: ""/);
  const clear = workspace.match(/<button type="button" aria-label="Prompt leeren"[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.doesNotMatch(clear, /setReferences|setActiveRun|setModelId|persist|submit/);
});

test("Video Editor has no prompt or chat draft that needs a clear action", () => {
  const workspace = readFileSync("components/video-editor-studio/video-editor-workspace.tsx", "utf8");
  assert.doesNotMatch(workspace, /<textarea|contentEditable|setPrompt|chatInput/);
});
