export type {
  DataProviderAdapter,
  DataSourcePlatformSnapshot,
  DataSourceSettingsSnapshot,
  ProviderAuthStatus,
  ProviderConnectionStatus,
  ProviderDataMode,
  ProviderHealth,
  ProviderId,
  ProviderRateLimit,
  ProviderSettingsEntry,
  ProviderSnapshot,
  ProviderSyncResult,
} from "./types";

export {
  DataSourceManager,
  loadDataSourcePlatformSnapshot,
  resolveDisplayStatus,
} from "./manager";

export type { ProviderDisplayStatus } from "./manager";

export { clearProviderCache, getCacheAgeMs } from "./cache";
export { getProviderAuthStatus } from "./auth";
export { PROVIDER_ADAPTERS, getProviderAdapter } from "./adapters";
