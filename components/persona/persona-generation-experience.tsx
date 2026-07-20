"use client";

import { Loader2 } from "lucide-react";
import { GENERATION_LOADING_MESSAGES } from "@/components/persona/persona-creator-ux";

/**
 * Premium generation loading UI — presentation only.
 * Not connected to provider / generation APIs.
 */
export function PersonaGenerationExperience({
  active = false,
  messageIndex = 0,
}: {
  active?: boolean;
  messageIndex?: number;
}) {
  const messages = GENERATION_LOADING_MESSAGES;
  const idx = ((messageIndex % messages.length) + messages.length) % messages.length;
  const progress = Math.round(((idx + 1) / messages.length) * 100);

  if (!active) return null;

  return (
    <div className="ps-gen-experience" role="status" aria-live="polite">
      <div className="ps-gen-experience-orb" aria-hidden>
        <Loader2 className="size-6 animate-spin" strokeWidth={1.25} />
      </div>
      <p className="ps-eyebrow">Premium generation</p>
      <h3 className="ps-gen-experience-title">{messages[idx]}</h3>
      <div className="ps-gen-experience-bar" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>
      <ul className="ps-gen-experience-log">
        {messages.slice(0, idx + 1).map((msg, i) => (
          <li key={`${msg}-${i}`} className={i === idx ? "is-current" : "is-done"}>
            {msg}
          </li>
        ))}
      </ul>
      <p className="ps-gen-experience-note">UI preview only — generation is not connected.</p>
    </div>
  );
}
