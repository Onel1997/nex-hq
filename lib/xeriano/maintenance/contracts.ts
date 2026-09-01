import { z } from "zod";

export const XERIAMO_MAINTENANCE_MESSAGE_MAX_LENGTH = 1_000;

export type XeriamoMaintenanceState = "ONLINE" | "MAINTENANCE";

export type XeriamoPublicMaintenanceStatus = {
  state: XeriamoMaintenanceState;
  message: string | null;
  expectedBackAt: string | null;
  discordEnabled: boolean;
  version: string;
};

export type XeriamoOwnerMaintenanceStatus = XeriamoPublicMaintenanceStatus & {
  updatedAt: string;
};

export const updateXeriamoMaintenanceSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(XERIAMO_MAINTENANCE_MESSAGE_MAX_LENGTH).nullable(),
    expectedBackAt: z.string().datetime({ offset: true }).nullable(),
    discordEnabled: z.boolean(),
  })
  .strict();

export const ONLINE_MAINTENANCE_STATUS: XeriamoPublicMaintenanceStatus = {
  state: "ONLINE",
  message: null,
  expectedBackAt: null,
  discordEnabled: false,
  version: "fallback-online",
};
