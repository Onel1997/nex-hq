import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  listCreativeAccountHistory,
  resolveCreativeAccountJobScope,
  type CreativeHistoryAuthority,
  type CreativeHistoryAuthorityRepository,
} from "@/lib/creative-studio/account-history";
import {
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
} from "@/lib/creative-studio/contracts";
import type { CreativeJobManifest } from "@/lib/creative-studio/server-contracts";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";

const A_JOB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B_JOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function context(accountId: string, userId: string, workspaceKey: string): XerianoAccountContext {
  return {
    accountId,
    userId,
    workspaceKey,
    email: `${userId}@example.test`,
    role: "CUSTOMER",
    accountName: accountId,
    brainWorkspaceId: null,
    source: "XERIANO_MEMBERSHIP",
  };
}

function manifest(jobId: string, workspaceId: string, actorId: string): CreativeJobManifest {
  const now = "2026-08-30T00:00:00.000Z";
  return {
    version: "nexhq-creative-generation-job-v1",
    jobId,
    workspaceId,
    actorId,
    requestFingerprint: "a".repeat(64),
    createdAt: now,
    updatedAt: now,
    status: "SUCCEEDED",
    setup: {
      contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
      prompt: `Prompt ${jobId}`,
      modelId: "nano-banana-pro",
      aspectRatio: "4:5",
      quality: "2K",
      batchSize: 1,
      outputType: "SOCIAL_ASSET",
      references: [],
      advanced: DEFAULT_CREATIVE_ADVANCED_SETTINGS,
    },
    originalPrompt: `Prompt ${jobId}`,
    providerPrompt: `Provider ${jobId}`,
    referenceAuthority: [],
    provider: "fal",
    providerModel: "private-model-route",
    providerRequestId: `provider-${jobId}`,
    estimatedMaximumCostUsd: 1,
    actualCostUsd: 1,
    results: [],
    message: "Fertig",
    technicalError: null,
  };
}

class MemoryAuthority implements CreativeHistoryAuthorityRepository {
  readonly requestedAccounts: string[] = [];
  constructor(private readonly rows: Record<string, CreativeHistoryAuthority[]>) {}
  async listAccountJobs(input: { accountId: string; limit: number }) {
    this.requestedAccounts.push(input.accountId);
    return (this.rows[input.accountId] ?? []).slice(0, input.limit);
  }
  async findAccountJob(input: { accountId: string; jobId: string }) {
    return (this.rows[input.accountId] ?? []).find((row) => row.jobId === input.jobId) ?? null;
  }
}

test("Creative Verlauf is derived from authenticated account authority and redacts provider metadata", async () => {
  const authority = new MemoryAuthority({
    "account-a": [{ jobId: A_JOB, actorUserId: "user-a", createdAt: "2026-08-30T00:00:00.000Z" }],
    "account-b": [{ jobId: B_JOB, actorUserId: "user-b", createdAt: "2026-08-30T00:00:00.000Z" }],
  });
  const manifests = new Map([
    [`workspace-a:user-a:${A_JOB}`, manifest(A_JOB, "workspace-a", "user-a")],
    [`workspace-b:user-b:${B_JOB}`, manifest(B_JOB, "workspace-b", "user-b")],
  ]);
  const store = {
    async readManifest(scope: { workspaceId: string; actorId: string }, jobId: string) {
      return manifests.get(`${scope.workspaceId}:${scope.actorId}:${jobId}`) ?? null;
    },
    async readReferenceSnapshot() { return null; },
  };

  const a = await listCreativeAccountHistory(
    { context: context("account-a", "user-a", "workspace-a") },
    { authority, store },
  );
  const b = await listCreativeAccountHistory(
    { context: context("account-b", "user-b", "workspace-b") },
    { authority, store },
  );
  assert.deepEqual(a.map((run) => run.id), [A_JOB]);
  assert.deepEqual(b.map((run) => run.id), [B_JOB]);
  assert.equal(a[0]?.providerRequestId, undefined);
  assert.equal(a[0]?.providerPrompt, undefined);
  assert.deepEqual(authority.requestedAccounts, ["account-a", "account-b"]);
});

test("an account cannot resolve another account's job storage scope", async () => {
  const authority = new MemoryAuthority({
    "account-a": [{ jobId: A_JOB, actorUserId: "user-a", createdAt: "2026-08-30T00:00:00.000Z" }],
    "account-b": [{ jobId: B_JOB, actorUserId: "user-b", createdAt: "2026-08-30T00:00:00.000Z" }],
  });
  assert.equal(
    await resolveCreativeAccountJobScope(
      { context: context("account-a", "user-a", "workspace-a"), jobId: B_JOB },
      authority,
    ),
    null,
  );
  assert.deepEqual(
    await resolveCreativeAccountJobScope(
      { context: context("account-a", "user-a", "workspace-a"), jobId: A_JOB },
      authority,
    ),
    { workspaceId: "workspace-a", actorId: "user-a" },
  );
});

test("customer History uses durable reads and zero-credit setup/prompt actions", () => {
  const workspace = readFileSync("components/creative-studio/creative-studio-workspace.tsx", "utf8");
  const history = readFileSync("components/creative-studio/creative-studio-library.tsx", "utf8");
  const route = readFileSync("app/api/creative-studio/history/route.ts", "utf8");
  assert.match(workspace, /fetchCreativeAccountHistory/);
  assert.match(workspace, /props\.customerMode[\s\S]*?\? \{ \.\.\.restored, runs: \[\] \}/);
  assert.match(route, /listCreativeAccountHistory/);
  assert.match(history, /onClick=\{\(\) => props\.onLoad\(run\)\}/);
  assert.match(history, /onClick=\{\(\) => props\.onSavePrompt\(run\)\}/);
  assert.doesNotMatch(history, /reserveCustomerGeneration|submitCreativeGeneration|Credits/);
});

test("History implementation has no staging or test-account authority", () => {
  const source = readFileSync("lib/creative-studio/account-history.ts", "utf8");
  assert.doesNotMatch(source, /wwfezmywxishfgwnijyd|milaene-hq|Customer A|test-account/i);
  assert.match(source, /\.eq\("account_id", input\.accountId\)/);
  assert.match(source, /\.eq\("studio", "CREATIVE_STUDIO"\)/);
});
