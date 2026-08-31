import {
  BrainCircuit,
  Check,
  CreditCard,
  Database,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { logoutOwner } from "@/app/auth-actions";
import { BrandingManager } from "@/components/settings/branding-manager";
import type {
  OwnerIntegrationPresentation,
  OwnerSettingsPresentation,
} from "@/lib/xeriano/owner-settings-presentation";

const INTEGRATION_ICONS: Record<OwnerIntegrationPresentation["id"], typeof Database> = {
  supabase: Database,
  fal: Sparkles,
  stripe: CreditCard,
  openai: BrainCircuit,
};

function IntegrationCard({ integration }: { integration: OwnerIntegrationPresentation }) {
  const Icon = INTEGRATION_ICONS[integration.id];
  return (
    <article className="owner-settings-integration-card">
      <div className="owner-settings-card-icon" aria-hidden="true"><Icon size={20} /></div>
      <div>
        <div className="owner-settings-card-heading">
          <h3>{integration.name}</h3>
          <span className={integration.configured ? "is-ready" : "is-unavailable"}>
            {integration.configured ? "Verbunden" : "Nicht verfügbar"}
          </span>
        </div>
        <p>{integration.description}</p>
      </div>
    </article>
  );
}

export function SettingsPanels({ presentation }: { presentation: OwnerSettingsPresentation }) {
  return (
    <div className="owner-settings-sections">
      <section className="owner-settings-section" aria-labelledby="owner-settings-general">
        <div className="owner-settings-section-heading">
          <p>Allgemein</p>
          <h2 id="owner-settings-general">Workspace</h2>
        </div>
        <article className="owner-settings-workspace-card">
          <div className="owner-settings-workspace-copy">
            <div className="owner-settings-card-icon is-workspace" aria-hidden="true"><ShieldCheck size={21} /></div>
            <div><h3>Xeriamo Owner Workspace</h3><p>Der geschützte Arbeitsbereich ist aktiv.</p></div>
          </div>
          <span className="owner-settings-environment"><Check size={14} aria-hidden="true" />{presentation.environmentLabel}</span>
        </article>
      </section>

      <section className="owner-settings-section" aria-labelledby="owner-settings-branding">
        <div className="owner-settings-section-heading">
          <p>Branding</p>
          <h2 id="owner-settings-branding">Brand Assets</h2>
          <span>Logo, Icon und Favicon verwalten – sicher versioniert und ohne Deployment.</span>
        </div>
        <BrandingManager />
      </section>

      <section className="owner-settings-section" aria-labelledby="owner-settings-integrations">
        <div className="owner-settings-section-heading">
          <p>Integrationen</p>
          <h2 id="owner-settings-integrations">Systemstatus</h2>
          <span>Nur sichere Verfügbarkeitsinformationen – keine Schlüssel oder Zugangsdaten.</span>
        </div>
        <div className="owner-settings-integrations-grid">
          {presentation.integrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      <section className="owner-settings-section" aria-labelledby="owner-settings-account">
        <div className="owner-settings-section-heading">
          <p>Account</p>
          <h2 id="owner-settings-account">Sitzung</h2>
        </div>
        <article className="owner-settings-account-card">
          <div><h3>Owner-Sitzung</h3><p>Beendet die aktuelle Supabase-Sitzung sicher auf diesem Gerät.</p></div>
          <form action={logoutOwner}>
            <button type="submit" className="owner-settings-signout"><LogOut size={18} aria-hidden="true" />Abmelden</button>
          </form>
        </article>
      </section>
    </div>
  );
}
