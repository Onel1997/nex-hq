"use client";

import { useRef, useState } from "react";

import { createSecureBrowserUuid } from "@/lib/browser/secure-uuid";

type Props = {
  action: "CHECKOUT" | "PORTAL";
  productCode?: string;
  children: React.ReactNode;
  className?: string;
};

export function XerianoBillingActionButton({
  action,
  productCode,
  children,
  className = "xeriano-catalog-plan-action",
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const endpoint = action === "PORTAL"
        ? "/api/xeriano/billing/portal"
        : "/api/xeriano/billing/checkout";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: action === "CHECKOUT" ? { "content-type": "application/json" } : undefined,
        body: action === "CHECKOUT"
          ? JSON.stringify({ productCode, requestId: requestId.current ??= createSecureBrowserUuid() })
          : undefined,
      });
      const payload = await response.json() as { url?: unknown };
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(action === "CHECKOUT"
          ? "Checkout konnte nicht gestartet werden. Bitte versuche es erneut."
          : "Die Abrechnung konnte nicht geöffnet werden. Bitte versuche es erneut.");
      }
      window.location.assign(payload.url);
    } catch {
      inFlight.current = false;
      setPending(false);
      setError(action === "CHECKOUT"
        ? "Checkout konnte nicht gestartet werden. Bitte versuche es erneut."
        : "Die Abrechnung konnte nicht geöffnet werden. Bitte versuche es erneut.");
    }
  }

  return (
    <span className="xeriano-billing-action-wrap">
      <button className={className} disabled={pending} onClick={start} type="button">
        {pending ? "Weiter zu Stripe …" : children}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </span>
  );
}
