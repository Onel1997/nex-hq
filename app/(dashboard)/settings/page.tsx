import { SettingsPanels } from "@/components/settings/settings-panels";

export default function SettingsPage() {
  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <p>OWNER · XERIAMO</p>
        <h1>Settings</h1>
        <span>Workspace preferences and internal configuration</span>
      </header>
      <SettingsPanels />
    </main>
  );
}
