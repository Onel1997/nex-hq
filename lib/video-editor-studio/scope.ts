import "server-only";

import type { XerianoAccountContext } from "@/lib/xeriano/auth";

export type VideoEditorScope = {
  workspaceId: string;
  actorId: string;
};

export function videoEditorScope(context: XerianoAccountContext): VideoEditorScope {
  return { workspaceId: context.workspaceKey, actorId: context.userId };
}
