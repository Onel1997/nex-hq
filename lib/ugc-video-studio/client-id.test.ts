import assert from "node:assert/strict";
import test from "node:test";

import { createUgcVideoClientId } from "@/lib/ugc-video-studio/client-id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("client ID uses native randomUUID when available", () => {
  const expected = "11111111-1111-4111-8111-111111111111";
  const id = createUgcVideoClientId({
    crypto: {
      randomUUID: () => expected,
      getRandomValues: (array) => array,
    },
  });
  assert.equal(id, expected);
});

test("client ID uses RFC4122 getRandomValues fallback", () => {
  const id = createUgcVideoClientId({
    crypto: {
      randomUUID: undefined,
      getRandomValues: (array) => {
        for (let index = 0; index < array.length; index += 1) array[index] = index;
        return array;
      },
    },
  });
  assert.match(id, UUID_V4);
});

test("client ID final UI fallback never throws and remains unique", () => {
  const first = createUgcVideoClientId({
    crypto: null,
    now: () => 1_777_777_777_777,
    random: () => 0.123456789,
  });
  const second = createUgcVideoClientId({
    crypto: null,
    now: () => 1_777_777_777_777,
    random: () => 0.123456789,
  });
  assert.match(first, UUID_V4);
  assert.match(second, UUID_V4);
  assert.notEqual(first, second);
});
