"use client";

import {
  getIntegrationStateLabels,
  getIntegrationStatuses,
} from "@/lib/i18n/data";
import type { IntegrationState } from "@/lib/config/integration-status";
import { useDictionary, useLocale, useWorkspace } from "@/lib/i18n";
import { OsPanel, OsPanelContent, OsPanelHeader } from "@/components/shared/os-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Bot, Cpu, Plug } from "lucide-react";

const INTEGRATION_STATE_STYLES: Record<IntegrationState, string> = {
  connected: "border-primary/30 bg-primary/10 text-primary",
  disconnected: "border-red-400/30 bg-red-400/10 text-red-300",
  planned: "border-border bg-muted/50 text-muted-foreground",
};

function IntegrationStatusCard({
  name,
  description,
  state,
  detail,
  stateLabel,
}: {
  name: string;
  description: string;
  state: IntegrationState;
  detail: string;
  stateLabel: string;
}) {
  return (
    <div className="luxury-surface flex items-start justify-between gap-6 rounded-2xl p-6">
      <div className="space-y-2">
        <p className="text-lg font-medium">{name}</p>
        <p className="text-base text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground/70">{detail}</p>
      </div>
      <Badge
        variant="outline"
        className={cn("shrink-0 text-sm font-normal", INTEGRATION_STATE_STYLES[state])}
      >
        {state === "connected" && (
          <span className="mr-2 size-2 rounded-full bg-primary" />
        )}
        {stateLabel}
      </Badge>
    </div>
  );
}

export function SettingsPanels() {
  const locale = useLocale();
  const workspace = useWorkspace();
  const { settings, common } = useDictionary();
  const integrations = getIntegrationStatuses(locale);
  const stateLabels = getIntegrationStateLabels(locale);

  return (
    <Tabs defaultValue="system" className="space-y-10">
      <TabsList className="h-12 bg-muted/30 p-1">
        <TabsTrigger value="system" className="gap-2 px-5 text-base">
          <Cpu className="size-4" />
          {settings.tabs.system}
        </TabsTrigger>
        <TabsTrigger value="ai" className="gap-2 px-5 text-base">
          <Bot className="size-4" />
          {settings.tabs.aiModels}
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2 px-5 text-base">
          <Plug className="size-4" />
          {settings.tabs.integrations}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="system" className="space-y-6">
        <OsPanel>
          <OsPanelHeader
            title={settings.workspace.title}
            subtitle={settings.workspace.subtitle}
          />
          <OsPanelContent className="space-y-6">
            <div className="grid gap-2">
              <Label className="text-base">{settings.workspace.nameLabel}</Label>
              <Input
                defaultValue={workspace.name}
                disabled
                className="h-12 text-base"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">{settings.workspace.darkMode}</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.workspace.darkModeDescription}
                </p>
              </div>
              <Switch checked disabled />
            </div>
          </OsPanelContent>
        </OsPanel>
      </TabsContent>

      <TabsContent value="ai" className="space-y-6">
        <OsPanel glow>
          <OsPanelHeader
            title={settings.ai.title}
            subtitle={settings.ai.subtitle}
          />
          <OsPanelContent className="space-y-6">
            <div className="grid gap-2">
              <Label className="text-base">{settings.ai.primaryModel}</Label>
              <Input defaultValue="gpt-4o" disabled className="h-12 text-base" />
            </div>
            <div className="grid gap-2">
              <Label className="text-base">{settings.ai.ceoAgent}</Label>
              <Input defaultValue="gpt-4o" disabled className="h-12 text-base" />
            </div>
            <Button size="lg" disabled className="mt-2">
              {settings.ai.save}
            </Button>
          </OsPanelContent>
        </OsPanel>
      </TabsContent>

      <TabsContent value="integrations" className="space-y-8">
        <div className="space-y-4">
          <p className="text-label">{settings.integrations.active}</p>
          {integrations
            .filter((i) => i.state !== "planned")
            .map((integration) => (
              <IntegrationStatusCard
                key={integration.id}
                {...integration}
                stateLabel={stateLabels[integration.state]}
              />
            ))}
        </div>
        <div className="space-y-4">
          <p className="text-label">{common.status.planned}</p>
          {integrations
            .filter((i) => i.state === "planned")
            .map((integration) => (
              <IntegrationStatusCard
                key={integration.id}
                {...integration}
                stateLabel={stateLabels[integration.state]}
              />
            ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
