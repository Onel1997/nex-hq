import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreativeClientId,
  isCreativeClientId,
} from "@/lib/creative-studio/client-id";

test("Creative client ID uses native randomUUID when it is available", () => {
  const nativeId = "123e4567-e89b-42d3-a456-426614174000";
  let calls = 0;
  const id = createCreativeClientId({
    crypto: {
      randomUUID() {
        calls += 1;
        return nativeId;
      },
    },
  });
  assert.equal(id, nativeId);
  assert.equal(calls, 1);
});

test("Creative client ID creates RFC4122 v4 IDs with getRandomValues", () => {
  let next = 0;
  const id = createCreativeClientId({
    crypto: {
      getRandomValues(target) {
        for (let index = 0; index < target.length; index += 1) {
          target[index] = next;
          next += 1;
        }
        return target;
      },
    },
  });
  assert.equal(id, "00010203-0405-4607-8809-0a0b0c0d0e0f");
  assert.equal(isCreativeClientId(id), true);
});

test("Creative client ID final fallback is valid, unique, and never throws", () => {
  const throwingCrypto = {
    randomUUID() {
      throw new TypeError("secure context required");
    },
    getRandomValues() {
      throw new TypeError("unavailable");
    },
  };
  const ids = Array.from({ length: 48 }, () =>
    createCreativeClientId({
      crypto: throwingCrypto,
      now: () => 1_777_777_777_777,
      random: () => 0.25,
    }),
  );
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.every(isCreativeClientId), true);
});

test("Creative client ID tolerates missing crypto and throwing entropy hooks", () => {
  assert.doesNotThrow(() =>
    createCreativeClientId({
      crypto: null,
      now: () => {
        throw new Error("clock unavailable");
      },
      random: () => {
        throw new Error("entropy unavailable");
      },
    }),
  );
});
