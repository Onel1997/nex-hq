/**
 * Creation project list/detail selection sync — guards against stale detail panel data.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProjectDetailReady,
  projectIdPrefix,
} from "@/components/persona/persona-studio-project-sync";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";

function project(id: string, overrides: Partial<PersonaCreationProject> = {}): PersonaCreationProject {
  return {
    id,
    workspace_id: "ws-1",
    name: "Quiet Luxury",
    description: "",
    gender_presentation: "Male",
    age_range: "28-35",
    height_range: "180 cm",
    body_type: "Lean",
    skin_tone_direction: "",
    face_shape_direction: "",
    hair_direction: "",
    facial_hair_direction: "",
    eye_direction: "",
    expression_direction: "",
    personality: "",
    fashion_style: "",
    brand_role: "primary_male",
    visual_keywords: "",
    excluded_features: "",
    preferred_brand_looks: "",
    preferred_outfits: "",
    intended_usage: "image_and_video",
    candidate_count: 0,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    status: "draft",
    generation_stage: "discovery",
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    actual_cost: 0,
    cost_confirmed_at: null,
    last_estimate_hash: null,
    last_estimate_at: null,
    last_confirmation_token: null,
    additional_description: "",
    created_by: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("persona studio project selection sync", () => {
  it("projectIdPrefix returns first 8 chars", () => {
    assert.equal(projectIdPrefix("f04d43f3-1a74-436d-a458-8e23658eebf1"), "f04d43f3");
  });

  it("detail is ready only when selected, loaded, and ids match", () => {
    const draft = project("aaaa-1111");
    assert.equal(
      isProjectDetailReady({
        selectedProjectId: "aaaa-1111",
        loadedProjectId: "aaaa-1111",
        loadedProject: draft,
      }),
      true,
    );
    assert.equal(
      isProjectDetailReady({
        selectedProjectId: "aaaa-1111",
        loadedProjectId: "bbbb-2222",
        loadedProject: project("bbbb-2222"),
      }),
      false,
    );
    assert.equal(
      isProjectDetailReady({
        selectedProjectId: "aaaa-1111",
        loadedProjectId: "aaaa-1111",
        loadedProject: project("bbbb-2222"),
      }),
      false,
    );
    assert.equal(
      isProjectDetailReady({
        selectedProjectId: null,
        loadedProjectId: null,
        loadedProject: null,
      }),
      false,
    );
  });

  it("distinguishes two same-name projects by id", () => {
    const projectA = project("aaaa-1111", { status: "draft", candidate_count: 0 });
    const projectB = project("bbbb-2222", {
      status: "review",
      candidate_count: 4,
      generation_stage: "discovery",
    });

    assert.notEqual(projectA.id, projectB.id);
    assert.equal(projectA.name, projectB.name);

    assert.equal(
      isProjectDetailReady({
        selectedProjectId: projectA.id,
        loadedProjectId: projectA.id,
        loadedProject: projectA,
      }),
      true,
    );
    assert.equal(
      isProjectDetailReady({
        selectedProjectId: projectA.id,
        loadedProjectId: projectB.id,
        loadedProject: projectB,
      }),
      false,
    );
  });
});
