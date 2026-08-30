import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import {
  clearVerifiedIdentityHeaders,
  NEXHQ_VERIFIED_USER_EMAIL_HEADER,
  NEXHQ_VERIFIED_USER_ID_HEADER,
} from "@/lib/auth/verified-request";

const read = (path: string) => readFileSync(path, "utf8");

function sourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx|css)$/.test(path) && !/\.test\./.test(path)
        ? [path]
        : [];
  });
}

test("Facility routes, UI modules, navigation, and SSE workload are removed", () => {
  for (const path of [
    "app/api/facility",
    "app/(dashboard)/facility",
    "components/facility",
    "lib/facility",
  ]) assert.equal(existsSync(path), false, path);

  const activeSource = ["app", "components", "lib", "brain"]
    .flatMap(sourceFiles)
    .map(read)
    .join("\n");
  assert.doesNotMatch(activeSource, /\/api\/facility|EventSource\s*\(/);
  assert.doesNotMatch(read("lib/i18n/data/hq-navigation.ts"), /facility/i);
});

test("normal Brain reads resolve workspace without reseeding static records", () => {
  assert.match(read("brain/seed/index.ts"), /export async function resolveWorkspace/);
  assert.match(read("brain/seed/index.ts"), /seedPromises/);
  assert.match(read("brain/seed/index.ts"), /recordExistsBySlug/);
  for (const path of [
    "lib/tasks/task-service.ts",
    "lib/tasks/task-reports.ts",
    "lib/persona/security/authorization.ts",
    "lib/workspace/inspector.ts",
  ]) {
    const source = read(path);
    assert.match(source, /resolveWorkspace/);
    assert.doesNotMatch(source, /ensureWorkspaceBrainSeeded/);
  }
  assert.match(read("app/api/brain/seed/route.ts"), /ensureWorkspaceBrainSeeded/);
});

test("Brain search is bounded and exact count is opt-in", () => {
  const source = read("brain/client/supabase-brain-client.ts");
  assert.match(source, /includeTotal\?: boolean/);
  assert.match(source, /Math\.min\(Math\.max\(options\.limit \?\? 100, 1\), 200\)/);
  assert.doesNotMatch(source, /select\("\*", \{ count: "exact" \}\)/);
});

test("remaining browser pollers are visibility-aware and overlap guarded", () => {
  for (const path of [
    "components/ugc-video-studio/ugc-video-studio-workspace.tsx",
    "components/image/image-studio-workspace.tsx",
    "components/image/deterministic-v2-panel.tsx",
    "components/research/v3/use-data-sources.ts",
  ]) assert.match(read(path), /visibilityState/);
  assert.match(
    read("lib/persona/creation/novelty-replacement-execution.ts"),
    /isPollingAllowed/,
  );
});

test("Persona mount and Image history use consolidated reads", () => {
  const personaRoute = read("app/api/persona/route.ts");
  assert.equal((personaRoute.match(/getPersonaStudioSnapshot\(/g) ?? []).length, 1);
  assert.doesNotMatch(personaRoute, /listPersonas|getPersonaDashboardCounts/);
  assert.match(personaRoute, /derivePersonaDashboardCounts/);
  assert.match(read("app/api/persona/health/route.ts"), /getCachedPersonaStudioHealth/);

  const imageRoute = read("app/api/image/v2/jobs/route.ts");
  assert.match(imageRoute, /getDeterministicRecoveries/);
  assert.match(imageRoute, /createImageProductionAssetAccessBatch/);
  assert.match(imageRoute, /DEFAULT_LIST_LIMIT = 50/);
  const contentSelector = read("components/image/content-pack-selector.tsx");
  assert.match(contentSelector, /view=content-history/);
  assert.doesNotMatch(contentSelector, /jobs\.map\(async \(job\)/);
});

test("middleware forwards only middleware-verified auth context", () => {
  const middleware = read("lib/supabase/middleware.ts");
  const server = read("lib/auth/server.ts");
  assert.match(middleware, /clearVerifiedIdentityHeaders/);
  assert.match(middleware, /NEXHQ_VERIFIED_USER_ID_HEADER/);
  assert.match(server, /NEXHQ_VERIFIED_USER_ID_HEADER/);
  assert.match(server, /createServerSupabase/); // safe fallback outside middleware

  const spoofed = new Headers({
    [NEXHQ_VERIFIED_USER_ID_HEADER]: "caller-controlled-user",
    [NEXHQ_VERIFIED_USER_EMAIL_HEADER]: "spoofed@example.test",
  });
  clearVerifiedIdentityHeaders(spoofed);
  assert.equal(spoofed.get(NEXHQ_VERIFIED_USER_ID_HEADER), null);
  assert.equal(spoofed.get(NEXHQ_VERIFIED_USER_EMAIL_HEADER), null);
});
