import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const APPROVED_STAGING_PROJECT_REF = "wwfezmywxishfgwnijyd";
const PRODUCTION_PROJECT_REF = "lggogmvpktedkimbpzix";
const MODEL_ID = "staging-credit-race-test";
const PRICING_VERSION = "staging-credit-race-v1";

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeProviderError(error) {
  if (!error) return null;
  return {
    code: typeof error.code === "string" ? error.code : null,
    message: typeof error.message === "string" ? error.message.slice(0, 300) : "Unbekannter Datenbankfehler",
    details: typeof error.details === "string" ? error.details.slice(0, 300) : null,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

function supabaseProjectRef(url) {
  const hostname = new URL(url).hostname;
  const [ref] = hostname.split(".");
  if (!ref || !hostname.endsWith(".supabase.co")) throw new Error("INVALID_SUPABASE_URL");
  return ref;
}

async function queryOrThrow(label, promise) {
  const result = await promise;
  if (result.error) {
    const error = safeProviderError(result.error);
    throw new Error(`${label}:${error?.code ?? "UNKNOWN"}:${error?.message ?? "UNKNOWN"}`);
  }
  return result;
}

async function snapshotAccount(admin, accountId) {
  const [account, subscription, buckets, reservations, claims, ledger] = await Promise.all([
    admin.from("xeriano_accounts").select("id,status,created_by").eq("id", accountId).single(),
    admin.from("xeriano_subscription_state").select("plan,status,monthly_credits,image_concurrency_limit,video_concurrency_limit").eq("account_id", accountId).single(),
    admin.from("xeriano_credit_buckets").select("id,bucket_type,source_key,granted_credits,remaining_credits,reserved_credits,expires_at,created_at").eq("account_id", accountId).order("created_at"),
    admin.from("xeriano_credit_reservations").select("id,job_id,idempotency_key,amount,status,operation,allocations").eq("account_id", accountId).order("created_at"),
    admin.from("xeriano_generation_claims").select("id,job_id,operation,status,reservation_id").eq("account_id", accountId).order("created_at"),
    admin.from("xeriano_credit_ledger").select("id,transaction_type,amount_delta,reserved_delta,resulting_available,idempotency_key,reservation_id,bucket_id").eq("account_id", accountId).order("created_at"),
  ]);
  for (const [label, result] of Object.entries({ account, subscription, buckets, reservations, claims, ledger })) {
    if (result.error) throw new Error(`snapshot_${label}:${safeProviderError(result.error)?.message}`);
  }
  const now = Date.now();
  const rows = buckets.data ?? [];
  return {
    account: account.data,
    subscription: subscription.data,
    buckets: rows,
    reservations: reservations.data ?? [],
    claims: claims.data ?? [],
    ledger: ledger.data ?? [],
    totals: {
      granted: rows.reduce((sum, row) => sum + row.granted_credits, 0),
      remaining: rows.reduce((sum, row) => sum + row.remaining_credits, 0),
      reserved: rows.reduce((sum, row) => sum + row.reserved_credits, 0),
      spendable: rows
        .filter((row) => row.expires_at === null || Date.parse(row.expires_at) > now)
        .reduce((sum, row) => sum + row.remaining_credits - row.reserved_credits, 0),
      activeReservations: (reservations.data ?? []).filter((row) => row.status === "RESERVED").length,
      activeClaims: (claims.data ?? []).filter((row) => row.status === "RUNNING").length,
      ledgerRows: ledger.data?.length ?? 0,
    },
  };
}

async function reserve(client, input) {
  const startedAt = performance.now();
  const result = await client.rpc("xeriano_reserve_credits", {
    p_account_id: input.accountId,
    p_job_id: input.jobId,
    p_idempotency_key: input.idempotencyKey,
    p_model_id: MODEL_ID,
    p_operation: input.operation,
    p_pricing_version: PRICING_VERSION,
    p_amount: input.amount,
  });
  return {
    ok: !result.error,
    reservation: result.data,
    error: safeProviderError(result.error),
    startedMs: startedAt,
    finishedMs: performance.now(),
  };
}

async function settle(admin, action, reservationId, idempotencyKey) {
  const functionName = {
    COMMIT: "xeriano_commit_credit_reservation",
    RELEASE: "xeriano_release_credit_reservation",
    REFUND: "xeriano_refund_credit_reservation",
  }[action];
  const result = await admin.rpc(functionName, {
    p_reservation_id: reservationId,
    p_idempotency_key: idempotencyKey,
  });
  return { ok: !result.error, reservation: result.data, error: safeProviderError(result.error) };
}

async function grantBucket(admin, { accountId, bucketType, sourceKey, credits, expiresAt, ledgerKey, resultingAvailable }) {
  const bucket = await queryOrThrow("grant_bucket", admin.from("xeriano_credit_buckets").insert({
    account_id: accountId,
    bucket_type: bucketType,
    source_key: sourceKey,
    granted_credits: credits,
    remaining_credits: credits,
    reserved_credits: 0,
    expires_at: expiresAt,
  }).select("id").single());
  await queryOrThrow("grant_ledger", admin.from("xeriano_credit_ledger").insert({
    account_id: accountId,
    bucket_id: bucket.data.id,
    transaction_type: "GRANT",
    amount_delta: credits,
    reserved_delta: 0,
    resulting_available: resultingAvailable,
    idempotency_key: ledgerKey,
    metadata: { contract: "xeriano-staging-credit-race-v1", sourceKey },
  }));
  return bucket.data.id;
}

function compactState(snapshot) {
  return {
    accountStatus: snapshot.account?.status,
    plan: snapshot.subscription?.plan,
    limits: {
      image: snapshot.subscription?.image_concurrency_limit,
      video: snapshot.subscription?.video_concurrency_limit,
    },
    totals: snapshot.totals,
    buckets: snapshot.buckets.map((row) => ({
      id: row.id,
      type: row.bucket_type,
      sourceKey: row.source_key,
      granted: row.granted_credits,
      remaining: row.remaining_credits,
      reserved: row.reserved_credits,
      expiresAt: row.expires_at,
    })),
    reservations: snapshot.reservations.map((row) => ({ id: row.id, jobId: row.job_id, amount: row.amount, operation: row.operation, status: row.status, allocations: row.allocations })),
    claims: snapshot.claims.map((row) => ({ jobId: row.job_id, operation: row.operation, status: row.status })),
    ledgerRows: snapshot.ledger.length,
  };
}

async function main() {
  if (!process.argv.includes("--execute")) throw new Error("REFUSED: pass --execute for the explicit staging-only database test");
  const confirmedRef = requiredArgument("--project-ref");
  if (confirmedRef !== APPROVED_STAGING_PROJECT_REF) throw new Error("REFUSED: exact staging project confirmation required");

  const environment = parseEnv(readFileSync("Staging-ENV", "utf8"));
  const actualRef = supabaseProjectRef(environment.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (actualRef === PRODUCTION_PROJECT_REF || actualRef !== APPROVED_STAGING_PROJECT_REF) {
    throw new Error(`REFUSED: project ${actualRef} is not the approved Xeriano staging project`);
  }
  if (!environment.SUPABASE_SERVICE_ROLE_KEY) throw new Error("REFUSED: staging service authority missing");

  const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
  const racerA = createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
  const racerB = createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
  const runId = `staging-race-test:${new Date().toISOString().replace(/[:.]/g, "-")}:${randomUUID().slice(0, 8)}`;
  const report = { contract: "xeriano-staging-credit-race-v1", projectRef: actualRef, runId, providerCalls: 0, checks: {} };
  let testAccountId = null;
  let creatorUserId = null;
  let customerABefore = null;
  let customerBBefore = null;
  let fatal = null;

  try {
    const customers = await queryOrThrow("customers", admin.from("xeriano_account_memberships")
      .select("account_id,user_id,created_at")
      .eq("role", "CUSTOMER").eq("status", "ACTIVE").eq("is_primary", true)
      .order("created_at", { ascending: true }).limit(2));
    assert((customers.data?.length ?? 0) >= 2, "CUSTOMER_A_AND_B_REQUIRED");
    const [customerA, customerB] = customers.data;
    creatorUserId = customerA.user_id;
    customerABefore = await snapshotAccount(admin, customerA.account_id);
    customerBBefore = await snapshotAccount(admin, customerB.account_id);
    report.customerAuthority = {
      testCreatorUserId: creatorUserId,
      customerAAccountId: customerA.account_id,
      customerBAccountId: customerB.account_id,
      customerABefore: compactState(customerABefore),
      customerBBefore: compactState(customerBBefore),
    };

    testAccountId = randomUUID();
    await queryOrThrow("create_test_account", admin.from("xeriano_accounts").insert({
      id: testAccountId,
      slug: `staging-credit-race-${testAccountId.replaceAll("-", "").slice(0, 20)}`,
      name: `STAGING CREDIT RACE ${runId.slice(-8)}`,
      created_by: creatorUserId,
      studio_workspace_key: `staging_credit_race_${testAccountId.replaceAll("-", "")}`,
      status: "ACTIVE",
    }));
    report.testAccountId = testAccountId;
    report.preTestSnapshot = compactState(await snapshotAccount(admin, testAccountId));
    assert(report.preTestSnapshot.totals.spendable === 40, "NEW_TEST_ACCOUNT_MUST_HAVE_40_TRIAL_CREDITS");

    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    await queryOrThrow("expire_test_trial", admin.from("xeriano_credit_buckets")
      .update({ expires_at: expiredAt }).eq("account_id", testAccountId).eq("source_key", "trial:v1"));
    await queryOrThrow("set_test_plan_pro", admin.from("xeriano_subscription_state").update({
      plan: "PRO", status: "ACTIVE", monthly_credits: 2000, image_concurrency_limit: 2, video_concurrency_limit: 2,
    }).eq("account_id", testAccountId));
    const topUpBucketId = await grantBucket(admin, {
      accountId: testAccountId, bucketType: "TOP_UP", sourceKey: `${runId}:top-up-100`, credits: 100,
      expiresAt: null, ledgerKey: `${runId}:grant:top-up-100`, resultingAvailable: 100,
    });
    const prepared = await snapshotAccount(admin, testAccountId);
    assert(prepared.totals.spendable === 100 && prepared.totals.reserved === 0, "EXACTLY_100_SPENDABLE_REQUIRED");
    report.creditSetup = { topUpBucketId, state: compactState(prepared) };

    const raceJobA = `${runId}:race-a`;
    const raceJobB = `${runId}:race-b`;
    const raceKeyA = `${runId}:reserve-a`;
    const raceKeyB = `${runId}:reserve-b`;
    const raceStarted = performance.now();
    const [raceA, raceB] = await Promise.all([
      reserve(racerA, { accountId: testAccountId, jobId: raceJobA, idempotencyKey: raceKeyA, operation: "IMAGE", amount: 80 }),
      reserve(racerB, { accountId: testAccountId, jobId: raceJobB, idempotencyKey: raceKeyB, operation: "IMAGE", amount: 80 }),
    ]);
    const successfulRace = [raceA, raceB].filter((entry) => entry.ok);
    const failedRace = [raceA, raceB].filter((entry) => !entry.ok);
    assert(successfulRace.length === 1 && failedRace.length === 1, "CONCURRENT_80_80_EXACTLY_ONE_SUCCESS");
    assert(failedRace[0].error?.message.includes("INSUFFICIENT_CREDITS"), "SECOND_RACE_MUST_SEE_INSUFFICIENT_CREDITS");
    const afterRace = await snapshotAccount(admin, testAccountId);
    assert(afterRace.totals.spendable === 20 && afterRace.totals.reserved === 80, "RACE_BALANCE_MUST_BE_20_AVAILABLE_80_RESERVED");
    assert(afterRace.totals.activeReservations === 1 && afterRace.totals.activeClaims === 1, "RACE_MUST_CREATE_ONE_RESERVATION_AND_CLAIM");
    report.checks.concurrent80x80 = { raceStartedMs: raceStarted, attempts: [raceA, raceB], state: compactState(afterRace) };

    const winningReservation = successfulRace[0].reservation;
    const winningJob = winningReservation.job_id;
    const winningKey = winningReservation.idempotency_key;
    const ledgerBeforeReplay = afterRace.totals.ledgerRows;
    const replay = await reserve(admin, { accountId: testAccountId, jobId: winningJob, idempotencyKey: winningKey, operation: "IMAGE", amount: 80 });
    assert(replay.ok && replay.reservation.id === winningReservation.id, "IDEMPOTENT_REPLAY_MUST_REUSE_RESERVATION");
    const afterReplay = await snapshotAccount(admin, testAccountId);
    assert(afterReplay.totals.ledgerRows === ledgerBeforeReplay && afterReplay.totals.reserved === 80, "REPLAY_MUST_HAVE_NO_SECOND_EFFECT");
    report.checks.idempotentReplay = { result: replay, state: compactState(afterReplay) };

    const sameJob = await reserve(admin, { accountId: testAccountId, jobId: winningJob, idempotencyKey: `${runId}:same-job-new-key`, operation: "IMAGE", amount: 10 });
    assert(!sameJob.ok && (sameJob.error?.code === "23505" || sameJob.error?.message.includes("duplicate key")), "SAME_JOB_DIFFERENT_KEY_MUST_BE_REFUSED");
    const afterSameJob = await snapshotAccount(admin, testAccountId);
    assert(afterSameJob.totals.ledgerRows === ledgerBeforeReplay && afterSameJob.totals.reserved === 80, "SAME_JOB_REFUSAL_MUST_HAVE_NO_EFFECT");
    report.checks.sameJobDifferentIdempotency = { result: sameJob, state: compactState(afterSameJob) };

    const sameKey = await reserve(admin, { accountId: testAccountId, jobId: `${runId}:different-job`, idempotencyKey: winningKey, operation: "IMAGE", amount: 80 });
    assert(!sameKey.ok && sameKey.error?.message.includes("CREDIT_IDEMPOTENCY_CONFLICT"), "SAME_KEY_DIFFERENT_JOB_MUST_CONFLICT");
    report.checks.sameIdempotencyDifferentJob = sameKey;

    const releaseKey = `${runId}:release-race`;
    const released = await settle(admin, "RELEASE", winningReservation.id, releaseKey);
    assert(released.ok && released.reservation.status === "RELEASED", "RELEASE_MUST_SUCCEED");
    const releaseReplay = await settle(admin, "RELEASE", winningReservation.id, releaseKey);
    assert(releaseReplay.ok && releaseReplay.reservation.status === "RELEASED", "RELEASE_REPLAY_MUST_BE_IDEMPOTENT");
    const afterRelease = await snapshotAccount(admin, testAccountId);
    assert(afterRelease.totals.spendable === 100 && afterRelease.totals.reserved === 0 && afterRelease.totals.activeClaims === 0, "RELEASE_MUST_RESTORE_EXACTLY_100");
    report.checks.release = { first: released, replay: releaseReplay, state: compactState(afterRelease) };

    const commitReservation = await reserve(admin, { accountId: testAccountId, jobId: `${runId}:commit-job`, idempotencyKey: `${runId}:commit-reserve`, operation: "IMAGE", amount: 60 });
    assert(commitReservation.ok, "COMMIT_TEST_RESERVATION_REQUIRED");
    const commitKey = `${runId}:commit-settle`;
    const committed = await settle(admin, "COMMIT", commitReservation.reservation.id, commitKey);
    assert(committed.ok && committed.reservation.status === "COMMITTED", "COMMIT_MUST_SUCCEED");
    const commitReplay = await settle(admin, "COMMIT", commitReservation.reservation.id, commitKey);
    assert(commitReplay.ok && commitReplay.reservation.status === "COMMITTED", "COMMIT_REPLAY_MUST_BE_IDEMPOTENT");
    const afterCommit = await snapshotAccount(admin, testAccountId);
    assert(afterCommit.totals.spendable === 40 && afterCommit.totals.reserved === 0, "COMMIT_MUST_CHARGE_EXACTLY_60");
    const releaseAfterCommit = await settle(admin, "RELEASE", commitReservation.reservation.id, `${runId}:invalid-release-after-commit`);
    assert(!releaseAfterCommit.ok && releaseAfterCommit.error?.message.includes("INVALID_RESERVATION_STATE"), "RELEASE_AFTER_COMMIT_MUST_FAIL");
    const refundKey = `${runId}:refund-commit`;
    const refunded = await settle(admin, "REFUND", commitReservation.reservation.id, refundKey);
    assert(refunded.ok && refunded.reservation.status === "REFUNDED", "COMMITTED_RESERVATION_MUST_REFUND_ONCE");
    const refundReplay = await settle(admin, "REFUND", commitReservation.reservation.id, refundKey);
    assert(refundReplay.ok && refundReplay.reservation.status === "REFUNDED", "REFUND_REPLAY_MUST_BE_IDEMPOTENT");
    const secondRefund = await settle(admin, "REFUND", commitReservation.reservation.id, `${runId}:invalid-second-refund`);
    assert(!secondRefund.ok && secondRefund.error?.message.includes("INVALID_RESERVATION_STATE"), "SECOND_REFUND_WITH_NEW_KEY_MUST_FAIL");
    const afterRefund = await snapshotAccount(admin, testAccountId);
    assert(afterRefund.totals.spendable === 100 && afterRefund.totals.reserved === 0, "REFUND_MUST_RESTORE_100");
    report.checks.commitAndRefund = { committed, commitReplay, releaseAfterCommit, refunded, refundReplay, secondRefund, state: compactState(afterRefund) };

    const releaseLifecycleReservation = await reserve(admin, { accountId: testAccountId, jobId: `${runId}:release-lifecycle-job`, idempotencyKey: `${runId}:release-lifecycle-reserve`, operation: "IMAGE", amount: 20 });
    assert(releaseLifecycleReservation.ok, "RELEASE_LIFECYCLE_RESERVATION_REQUIRED");
    const refundBeforeCommit = await settle(admin, "REFUND", releaseLifecycleReservation.reservation.id, `${runId}:invalid-refund-before-commit`);
    assert(!refundBeforeCommit.ok && refundBeforeCommit.error?.message.includes("INVALID_RESERVATION_STATE"), "REFUND_BEFORE_COMMIT_MUST_FAIL");
    const lifecycleRelease = await settle(admin, "RELEASE", releaseLifecycleReservation.reservation.id, `${runId}:release-lifecycle`);
    assert(lifecycleRelease.ok, "LIFECYCLE_RELEASE_MUST_SUCCEED");
    const commitAfterRelease = await settle(admin, "COMMIT", releaseLifecycleReservation.reservation.id, `${runId}:invalid-commit-after-release`);
    assert(!commitAfterRelease.ok && commitAfterRelease.error?.message.includes("INVALID_RESERVATION_STATE"), "COMMIT_AFTER_RELEASE_MUST_FAIL");
    report.checks.invalidLifecycle = { refundBeforeCommit, lifecycleRelease, commitAfterRelease, state: compactState(await snapshotAccount(admin, testAccountId)) };

    const subscriptionBucketId = await grantBucket(admin, {
      accountId: testAccountId, bucketType: "SUBSCRIPTION", sourceKey: `${runId}:subscription-30`, credits: 30,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(), ledgerKey: `${runId}:grant:subscription-30`, resultingAvailable: 130,
    });
    const multi = await reserve(admin, { accountId: testAccountId, jobId: `${runId}:multi-bucket-job`, idempotencyKey: `${runId}:multi-bucket-reserve`, operation: "IMAGE", amount: 50 });
    assert(multi.ok, "MULTI_BUCKET_RESERVATION_REQUIRED");
    const allocations = multi.reservation.allocations;
    assert(allocations.length === 2, "MULTI_BUCKET_MUST_HAVE_TWO_ALLOCATIONS");
    assert(allocations[0].bucketId === subscriptionBucketId && allocations[0].amount === 30, "EXPIRING_SUBSCRIPTION_MUST_SPEND_FIRST");
    assert(allocations[1].bucketId === topUpBucketId && allocations[1].amount === 20, "TOP_UP_MUST_SPEND_SECOND");
    const multiRelease = await settle(admin, "RELEASE", multi.reservation.id, `${runId}:multi-bucket-release`);
    assert(multiRelease.ok, "MULTI_BUCKET_RELEASE_REQUIRED");
    const afterMulti = await snapshotAccount(admin, testAccountId);
    assert(afterMulti.totals.spendable === 130 && afterMulti.totals.reserved === 0, "MULTI_BUCKET_RELEASE_MUST_RESTORE_130");
    report.checks.multiBucket = { reservation: multi, release: multiRelease, state: compactState(afterMulti) };

    const expiredAttempt = await reserve(admin, { accountId: testAccountId, jobId: `${runId}:expired-credit-job`, idempotencyKey: `${runId}:expired-credit-reserve`, operation: "IMAGE", amount: 131 });
    assert(!expiredAttempt.ok && expiredAttempt.error?.message.includes("INSUFFICIENT_CREDITS"), "EXPIRED_TRIAL_MUST_NOT_BE_SPENDABLE");
    const afterExpired = await snapshotAccount(admin, testAccountId);
    assert(afterExpired.totals.remaining === 170 && afterExpired.totals.spendable === 130, "EXPIRED_BUCKET_MUST_BE_EXCLUDED_FROM_SPENDABLE_TOTAL");
    report.checks.expiredBucket = { result: expiredAttempt, state: compactState(afterExpired) };

    await queryOrThrow("set_test_plan_creator", admin.from("xeriano_subscription_state").update({
      plan: "CREATOR", status: "ACTIVE", monthly_credits: 800, image_concurrency_limit: 1, video_concurrency_limit: 1,
    }).eq("account_id", testAccountId));
    for (const operation of ["IMAGE", "VIDEO"]) {
      const operationKey = operation.toLowerCase();
      const [first, second] = await Promise.all([
        reserve(racerA, { accountId: testAccountId, jobId: `${runId}:${operationKey}-concurrency-a`, idempotencyKey: `${runId}:${operationKey}-concurrency-reserve-a`, operation, amount: 10 }),
        reserve(racerB, { accountId: testAccountId, jobId: `${runId}:${operationKey}-concurrency-b`, idempotencyKey: `${runId}:${operationKey}-concurrency-reserve-b`, operation, amount: 10 }),
      ]);
      const success = [first, second].filter((entry) => entry.ok);
      const failure = [first, second].filter((entry) => !entry.ok);
      assert(success.length === 1 && failure.length === 1, `${operation}_CONCURRENCY_EXACTLY_ONE_SUCCESS`);
      assert(failure[0].error?.message.includes("CONCURRENCY_LIMIT_REACHED"), `${operation}_SECOND_CLAIM_MUST_REACH_LIMIT`);
      const during = await snapshotAccount(admin, testAccountId);
      assert(during.totals.reserved === 10 && during.totals.activeClaims === 1, `${operation}_REFUSED_CLAIM_MUST_NOT_CONSUME_CREDITS`);
      const terminal = await settle(admin, "RELEASE", success[0].reservation.id, `${runId}:${operationKey}-concurrency-release`);
      assert(terminal.ok, `${operation}_CONCURRENCY_RELEASE_REQUIRED`);
      const after = await snapshotAccount(admin, testAccountId);
      assert(after.totals.reserved === 0 && after.totals.activeClaims === 0, `${operation}_SLOT_MUST_REOPEN`);
      report.checks[`${operationKey}Concurrency`] = { attempts: [first, second], during: compactState(during), release: terminal, after: compactState(after) };
    }
  } catch (error) {
    fatal = error instanceof Error ? error.message : String(error);
    report.failure = fatal;
  } finally {
    if (testAccountId) {
      const current = await snapshotAccount(admin, testAccountId).catch(() => null);
      for (const reservation of current?.reservations.filter((row) => row.status === "RESERVED") ?? []) {
        await settle(admin, "RELEASE", reservation.id, `${runId}:cleanup:${reservation.id}`);
      }
      await admin.from("xeriano_accounts").update({ status: "CLOSED" }).eq("id", testAccountId);
      report.finalTestAccount = compactState(await snapshotAccount(admin, testAccountId));
    }
    if (report.customerAuthority) {
      const customerAAfter = await snapshotAccount(admin, report.customerAuthority.customerAAccountId);
      const customerBAfter = await snapshotAccount(admin, report.customerAuthority.customerBAccountId);
      report.customerIsolation = {
        customerAUnchanged: JSON.stringify(compactState(customerABefore)) === JSON.stringify(compactState(customerAAfter)),
        customerBUnchanged: JSON.stringify(compactState(customerBBefore)) === JSON.stringify(compactState(customerBAfter)),
        customerAAfter: compactState(customerAAfter),
        customerBAfter: compactState(customerBAfter),
      };
    }
  }

  const final = report.finalTestAccount;
  if (final) {
    assert(final.accountStatus === "CLOSED", "TEST_ACCOUNT_MUST_BE_CLOSED");
    assert(final.totals.reserved === 0 && final.totals.activeReservations === 0 && final.totals.activeClaims === 0, "CLEANUP_MUST_LEAVE_NO_ACTIVE_FINANCIAL_AUTHORITY");
  }
  assert(report.customerIsolation?.customerAUnchanged, "CUSTOMER_A_MUST_REMAIN_UNCHANGED");
  assert(report.customerIsolation?.customerBUnchanged, "CUSTOMER_B_MUST_REMAIN_UNCHANGED");
  console.log(JSON.stringify(report, null, 2));
  if (fatal) process.exitCode = 1;
}

await main();
