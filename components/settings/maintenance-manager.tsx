"use client";

import { Check, Clock3, Eye, Loader2, Power, ShieldCheck, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { XeriamoOwnerMaintenanceStatus } from "@/lib/xeriano/maintenance/contracts";

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : "Der Xeriamo Status konnte nicht aktualisiert werden.";
}

export function MaintenanceManager() {
  const [status, setStatus] = useState<XeriamoOwnerMaintenanceStatus | null>(null);
  const [message, setMessage] = useState("");
  const [expectedBackAt, setExpectedBackAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/hq/maintenance", { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as { status?: XeriamoOwnerMaintenanceStatus; error?: string };
      if (!response.ok || !body.status) throw new Error(body.error ?? "Der Xeriamo Status ist gerade nicht verfügbar.");
      setStatus(body.status);
      setMessage(body.status.message ?? "");
      setExpectedBackAt(toLocalDateTime(body.status.expectedBackAt));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Der Xeriamo Status ist gerade nicht verfügbar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(enabled: boolean) {
    setBusy(true);
    setConfirming(false);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/hq/maintenance", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          message: message.trim() || null,
          expectedBackAt: expectedBackAt ? new Date(expectedBackAt).toISOString() : null,
          discordEnabled: status?.discordEnabled ?? false,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = await response.json() as { status: XeriamoOwnerMaintenanceStatus };
      setStatus(body.status);
      setMessage(body.status.message ?? "");
      setExpectedBackAt(toLocalDateTime(body.status.expectedBackAt));
      setNotice(enabled ? "Wartungsmodus aktiviert." : "Xeriamo ist wieder online.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Der Xeriamo Status konnte nicht aktualisiert werden.");
    } finally {
      setBusy(false);
    }
  }

  const maintenance = status?.state === "MAINTENANCE";
  return (
    <div className="owner-maintenance-manager">
      {notice ? <div className="owner-maintenance-notice is-success" role="status"><Check size={17} />{notice}</div> : null}
      {error ? <div className="owner-maintenance-notice is-error" role="alert">{error}</div> : null}
      {loading ? <div className="owner-maintenance-loading"><Loader2 className="spin" size={18} />Status wird geladen …</div> : null}
      {!loading && status ? (
        <article className={`owner-maintenance-card${maintenance ? " is-maintenance" : " is-online"}`}>
          <header>
            <span className="owner-maintenance-icon" aria-hidden="true">{maintenance ? <Wrench /> : <ShieldCheck />}</span>
            <div>
              <p>Xeriamo Status</p>
              <h3>{maintenance ? "Wartungsarbeiten" : "Online"}</h3>
            </div>
            <span className="owner-maintenance-state"><i aria-hidden="true" />{maintenance ? "Wartung" : "Online"}</span>
          </header>

          <div className="owner-maintenance-fields">
            <label>
              Wartungstext <span>optional</span>
              <textarea
                value={message}
                maxLength={1_000}
                rows={3}
                placeholder="Wir verbessern Xeriamo und sind in Kürze wieder da."
                onChange={(event) => setMessage(event.currentTarget.value)}
              />
            </label>
            <label>
              Erwartet wieder online <span>optional</span>
              <span className="owner-maintenance-time-input"><Clock3 size={17} aria-hidden="true" /><input type="datetime-local" value={expectedBackAt} onChange={(event) => setExpectedBackAt(event.currentTarget.value)} /></span>
            </label>
          </div>

          <footer>
            <a href="/maintenance?preview=1" target="_blank" rel="noreferrer"><Eye size={17} />Vorschau ansehen</a>
            {maintenance ? (
              <>
                <button type="button" disabled={busy} onClick={() => void update(true)}>
                  {busy ? <Loader2 className="spin" /> : <Check size={17} />}Einstellungen speichern
                </button>
                <button type="button" className="is-online-action" disabled={busy} onClick={() => void update(false)}>
                  <Power size={17} />Online schalten
                </button>
              </>
            ) : (
              <button type="button" className="is-maintenance-action" disabled={busy} onClick={() => setConfirming(true)}>
                <Wrench size={17} />Wartungsmodus aktivieren
              </button>
            )}
          </footer>
        </article>
      ) : null}

      {confirming ? (
        <div className="owner-maintenance-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirming(false); }}>
          <section className="owner-maintenance-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-maintenance-dialog-title">
            <span className="owner-maintenance-dialog-icon" aria-hidden="true"><Wrench size={22} /></span>
            <h3 id="owner-maintenance-dialog-title">Wartungsmodus wirklich aktivieren?</h3>
            <p>Kunden und Besucher können Xeriamo vorübergehend nicht verwenden. Dein OWNER-Bereich und laufende Hintergrundprozesse bleiben weiterhin aktiv.</p>
            <footer>
              <button type="button" onClick={() => setConfirming(false)}>Abbrechen</button>
              <button type="button" className="is-confirm" onClick={() => void update(true)}>Wartungsmodus aktivieren</button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
