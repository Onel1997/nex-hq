/**
 * Development-only Persona Studio E2E verification checklist.
 * Served only when NODE_ENV !== 'production'.
 */

import { NextResponse } from "next/server";

const CHECKLIST = {
  title: "Persona Studio Phase 1.1 — Manual E2E Checklist",
  environment: "development",
  flow: [
    {
      section: "Persona",
      steps: [
        "Open /agents/persona",
        "Confirm health badge shows „Bereit“ (otherwise apply migrations / fix storage)",
        "Create Persona „Milan Test“",
        "Fill required profile fields (gender, age_range, height, body_type, skin_tone, hair, eye_color, expression, personality, style)",
        "Add visual_identity_notes",
        "Add prohibited_changes",
        "Set image_use_approved = true",
      ],
    },
    {
      section: "References",
      steps: [
        "Upload one portrait (JPEG/PNG/WebP)",
        "Upload one full-body or half-body reference",
        "For each: confirm rights, classify asset type, set view angle, approve",
        "Select primary portrait",
        "Confirm signed preview URLs (not public /object/public/… paths)",
      ],
    },
    {
      section: "Workflow",
      steps: [
        "Attempt Approve while incomplete → must fail with Freigabevoraussetzungen",
        "Move Draft → Review",
        "Move Review → Approved (only after prerequisites met)",
      ],
    },
    {
      section: "Production eligibility",
      steps: [
        "Confirm listImageReadyPersonas includes Milan Test",
        "Confirm listVideoReadyPersonas excludes it while video_use_approved=false",
        "Confirm getPersonaProductionPackage has approved refs, primary, preferences, prohibited_changes",
        "Optionally set video_use_approved and re-check video-ready list",
      ],
    },
    {
      section: "Persistence / audit",
      steps: [
        "Restart dev server; persona still listed",
        "Confirm brain_events contains persona.created, reference_uploaded, reference_approved, primary_reference_changed, submitted_for_review, approved",
        "Archive persona; confirm persona.archived event",
      ],
    },
  ],
  note: "Persona Creator, Image Studio, and Video Studio are intentionally not started in Phase 1.1.",
} as const;

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  return NextResponse.json(CHECKLIST);
}
