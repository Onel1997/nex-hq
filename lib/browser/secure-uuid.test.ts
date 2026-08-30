import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createSecureBrowserUuid,
  SecureBrowserRandomUnavailableError,
  SECURE_UUID_V4_PATTERN,
} from "./secure-uuid";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("secure browser UUID uses native randomUUID when available", () => {
  const expected = "123e4567-e89b-42d3-a456-426614174000";
  let calls = 0;
  const result = createSecureBrowserUuid({
    randomUUID() {
      calls += 1;
      return expected;
    },
  });
  assert.equal(result, expected);
  assert.equal(calls, 1);
});

test("missing randomUUID uses cryptographically secure RFC 4122 v4 fallback", () => {
  let next = 0;
  const result = createSecureBrowserUuid({
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = next++;
      return bytes;
    },
  });
  assert.equal(result, "00010203-0405-4607-8809-0a0b0c0d0e0f");
  assert.match(result, SECURE_UUID_V4_PATTERN);
});

test("secure fallback produces non-repeating UUIDs", () => {
  let sequence = 0;
  const source = {
    getRandomValues(bytes: Uint8Array) {
      sequence += 1;
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = (sequence * 37 + index * 19) & 0xff;
      }
      return bytes;
    },
  };
  const ids = Array.from({ length: 64 }, () => createSecureBrowserUuid(source));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.every((id) => SECURE_UUID_V4_PATTERN.test(id)), true);
});

test("invalid or throwing randomUUID falls through to getRandomValues", () => {
  const result = createSecureBrowserUuid({
    randomUUID() { throw new TypeError("unsupported"); },
    getRandomValues(bytes) { bytes.fill(0xaa); return bytes; },
  });
  assert.equal(result, "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
});

test("unavailable secure randomness fails closed without Math.random", () => {
  assert.throws(
    () => createSecureBrowserUuid(null),
    SecureBrowserRandomUnavailableError,
  );
  assert.doesNotMatch(read("lib/browser/secure-uuid.ts"), /Math\.random|Date\.now|setTimeout/);
});

test("subscription and top-up Checkout share the compatibility helper and stable retry ID", () => {
  const button = read("components/xeriano/billing-action-button.tsx");
  const catalog = read("components/xeriano/billing-catalog.tsx");
  assert.match(button, /requestId\.current \?\?= createSecureBrowserUuid\(\)/);
  assert.match(button, /inFlight\.current/);
  assert.doesNotMatch(button, /crypto\.randomUUID\s*\(/);
  assert.match(catalog, /productCode=\{productCode\}/);
  assert.match(catalog, /productCode=\{`TOPUP_\$\{topUp\.grantedCredits\}`\}/);
});

test("browser crypto failures render only customer-safe billing errors", () => {
  const button = read("components/xeriano/billing-action-button.tsx");
  assert.match(button, /Checkout konnte nicht gestartet werden\. Bitte versuche es erneut\./);
  assert.doesNotMatch(button, /caught instanceof Error|caught\.message|SECURE_BROWSER_RANDOM_UNAVAILABLE/);
});
