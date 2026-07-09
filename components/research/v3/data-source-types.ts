import type {
  DataSourcePlatformSnapshot,
  DataSourceSettingsSnapshot,
  ProviderId,
  ProviderSettingsEntry,
  ProviderSnapshot,
} from "@/lib/data-source-platform/types";

export type {
  DataSourcePlatformSnapshot,
  DataSourceSettingsSnapshot,
  ProviderId,
  ProviderSettingsEntry,
  ProviderSnapshot,
};

export interface DataSourcesResponse {
  ok: boolean;
  snapshot?: DataSourcePlatformSnapshot;
  error?: string;
}

export interface ProviderActionResponse {
  ok: boolean;
  provider?: unknown;
  health?: unknown;
  error?: string;
}
