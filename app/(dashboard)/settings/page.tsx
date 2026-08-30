import { SettingsPanels } from "@/components/settings/settings-panels";
import { resolveOwnerSettingsPresentation } from "@/lib/xeriano/owner-settings-presentation";

export default function SettingsPage() {
  const presentation = resolveOwnerSettingsPresentation(process.env);
  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <p>OWNER · XERIAMO</p>
        <h1>Einstellungen</h1>
        <span>Workspace, Integrationen und deine Owner-Sitzung.</span>
      </header>
      <SettingsPanels presentation={presentation} />
    </main>
  );
}
