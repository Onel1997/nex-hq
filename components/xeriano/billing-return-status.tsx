"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { XerianoBillingReturnState } from "@/lib/xeriano/billing-return";

const MAX_REFRESH_ATTEMPTS = 6;
const REFRESH_DELAY_MS = 2_500;
const CONFIRMED_NOTICE_MS = 4_000;

export function XerianoBillingReturnStatus({ state }: { state: XerianoBillingReturnState }) {
  const router = useRouter();
  const [refreshAttempt, setRefreshAttempt] = useState(0);

  useEffect(() => {
    if (state.status !== "PROCESSING" || refreshAttempt >= MAX_REFRESH_ATTEMPTS) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setRefreshAttempt((attempt) => attempt + 1);
    }, REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [refreshAttempt, router, state.status]);

  useEffect(() => {
    if (state.status !== "CONFIRMED") return;
    const timer = window.setTimeout(() => {
      router.replace("/app/credits", { scroll: false });
    }, CONFIRMED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [router, state.status]);

  if (state.status === "CONFIRMED") {
    return (
      <section className="xeriano-billing-return is-confirmed" role="status">
        <div>
          <strong>{state.kind === "TOP_UP" ? "Credits wurden hinzugefügt." : "Zahlung bestätigt."}</strong>
          <span>Dein Kontostand und Plan zeigen bereits den bestätigten Stand.</span>
        </div>
        <Link href="/app/credits">Schließen</Link>
      </section>
    );
  }

  return (
    <section className="xeriano-billing-return" role="status">
      <div>
        <strong>Zahlung wird bestätigt</strong>
        <span>Credits erscheinen erst nach der bestätigten Stripe-Webhook-Verarbeitung.</span>
      </div>
      <Link href="/app/credits">Status aktualisieren</Link>
    </section>
  );
}
