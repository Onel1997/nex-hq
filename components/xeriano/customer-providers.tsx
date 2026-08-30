"use client";

import type { ReactNode } from "react";

import { I18nProvider } from "@/lib/i18n";
import type { WorkspaceDefinition } from "@/brain/workspaces/types";

const XERIANO_I18N_WORKSPACE: WorkspaceDefinition = {
  slug: "xeriano-customer",
  name: "Xeriamo",
  industryId: "creator_hq",
  seedRecords: [],
};

/** Shared compatibility boundary for frozen NexHQ UI reused in Xeriamo. */
export function XerianoCustomerProviders({ children }: { children: ReactNode }) {
  return <I18nProvider locale="de" workspace={XERIANO_I18N_WORKSPACE}>{children}</I18nProvider>;
}
