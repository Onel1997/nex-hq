"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createSecureBrowserUuid } from "@/lib/browser/secure-uuid";

export function OwnerManualCreditGrant({
  accountId,
  customerEmail,
}: {
  accountId: string;
  customerEmail: string;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const numericAmount = Number(amount);
  const valid = Number.isSafeInteger(numericAmount) && numericAmount > 0 && numericAmount <= 1_000_000
    && reason.trim().length >= 2 && reason.trim().length <= 500;

  function resetIdentity() {
    requestId.current = null;
    setMessage(null);
  }

  async function grant() {
    if (!valid || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/hq/customers/${encodeURIComponent(accountId)}/credits`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current ??= createSecureBrowserUuid(),
          amount: numericAmount,
          reason: reason.trim(),
        }),
      });
      const payload = await response.json() as { success?: unknown; error?: unknown };
      if (!response.ok || payload.success !== true) throw new Error("MANUAL_GRANT_FAILED");
      setConfirming(false);
      setAmount("");
      setReason("");
      requestId.current = null;
      setMessage("Credits wurden bestätigt gutgeschrieben.");
      router.refresh();
    } catch {
      setMessage("Die Gutschrift konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="owner-customer-grant-card">
      <div>
        <span className="owner-customer-kicker">OWNER-Aktion</span>
        <h2>Credits gutschreiben</h2>
        <p>Erstellt einen separaten, nicht-kommerziellen Manual-Bucket mit unveränderbarer Ledger-Evidenz.</p>
      </div>
      <div className="owner-customer-grant-fields">
        <label>
          <span>Credits</span>
          <input
            inputMode="numeric"
            min={1}
            max={1_000_000}
            onChange={(event) => { setAmount(event.target.value); resetIdentity(); }}
            placeholder="500"
            type="number"
            value={amount}
          />
        </label>
        <label>
          <span>Grund</span>
          <input
            maxLength={500}
            onChange={(event) => { setReason(event.target.value); resetIdentity(); }}
            placeholder="Private Beta"
            type="text"
            value={reason}
          />
        </label>
      </div>
      <button className="owner-customer-primary-action" disabled={!valid || pending} onClick={() => setConfirming(true)} type="button">
        Credits gutschreiben
      </button>
      {message ? <p className="owner-customer-form-message" role="status">{message}</p> : null}
      {confirming ? (
        <div className="owner-customer-confirm-backdrop" role="presentation" onPointerDown={() => !pending && setConfirming(false)}>
          <section aria-labelledby="manual-grant-title" aria-modal="true" className="owner-customer-confirm" onPointerDown={(event) => event.stopPropagation()} role="dialog">
            <span className="owner-customer-kicker">Gutschrift bestätigen</span>
            <h2 id="manual-grant-title">{numericAmount.toLocaleString("de-DE")} Credits an {customerEmail} gutschreiben?</h2>
            <p>Grund: {reason.trim()}</p>
            <div>
              <button disabled={pending} onClick={() => setConfirming(false)} type="button">Abbrechen</button>
              <button className="owner-customer-primary-action" disabled={pending} onClick={grant} type="button">
                {pending ? "Wird gespeichert …" : "Verbindlich gutschreiben"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
