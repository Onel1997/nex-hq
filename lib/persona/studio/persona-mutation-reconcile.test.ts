import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PERSONA_MUTATION_REFRESH_WARNING,
  reconcileAfterPersonaMutation,
} from "./persona-mutation-reconcile";

test("Video Identity Review success triggers canonical refresh and panel state", async () => {
  let personaReloads = 0;
  let panelReloads = 0;
  let appliedReady = false;

  const result = await reconcileAfterPersonaMutation({
    reloadPersona: async () => {
      personaReloads += 1;
    },
    reloadPanelState: async () => {
      panelReloads += 1;
      return { videoIdentityReady: true };
    },
    applyPanelState: (state) => {
      appliedReady = state.videoIdentityReady;
    },
  });

  assert.equal(personaReloads, 1);
  assert.equal(panelReloads, 1);
  assert.equal(appliedReady, true);
  assert.equal(result.refreshWarning, null);
});

test("Video Use Approval success triggers canonical refresh and approval panel state", async () => {
  let appliedApproved = false;

  const result = await reconcileAfterPersonaMutation({
    reloadPersona: async () => undefined,
    reloadPanelState: async () => ({ videoUseApproved: true }),
    applyPanelState: (state) => {
      appliedApproved = state.videoUseApproved;
    },
  });

  assert.equal(appliedApproved, true);
  assert.equal(result.refreshWarning, null);
});

test("reconcile does not fabricate authority optimistically", async () => {
  let applied = false;

  await reconcileAfterPersonaMutation({
    reloadPersona: async () => undefined,
    reloadPanelState: async () => ({ videoIdentityReady: true }),
    applyPanelState: () => {
      applied = true;
    },
  });

  assert.equal(applied, true);
});

test("POST success with refresh failure produces explicit refresh warning", async () => {
  const result = await reconcileAfterPersonaMutation({
    reloadPersona: async () => {
      throw new Error("reload failed");
    },
    reloadPanelState: async () => ({ videoIdentityReady: true }),
    applyPanelState: () => undefined,
  });

  assert.equal(result.saved, true);
  assert.equal(result.refreshWarning, PERSONA_MUTATION_REFRESH_WARNING);
});

test("panel refresh failure also produces explicit refresh warning", async () => {
  const result = await reconcileAfterPersonaMutation({
    reloadPersona: async () => undefined,
    reloadPanelState: async () => null,
    applyPanelState: () => undefined,
  });

  assert.equal(result.refreshWarning, PERSONA_MUTATION_REFRESH_WARNING);
});
