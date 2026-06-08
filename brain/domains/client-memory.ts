/**
 * Client Memory — Agency HQ industry domain.
 */

export type ClientStatus = "prospect" | "active" | "paused" | "churned";

export interface ClientContact {
  name: string;
  role?: string;
  email?: string;
}

export interface ClientMemoryContent {
  kind: "client_memory";
  clientId: string;
  name: string;
  status: ClientStatus;
  industry?: string;
  contacts?: ClientContact[];
  scopeOfWork?: string;
  retainerValue?: number;
  currency?: string;
  notes?: string;
}
