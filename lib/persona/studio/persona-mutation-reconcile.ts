export const PERSONA_MUTATION_REFRESH_WARNING =
  "Freigabe wurde gespeichert, der aktuelle Status konnte aber nicht neu geladen werden. Erneut laden.";

export const VIDEO_IDENTITY_REVIEW_SAVING_LABEL =
  "Video-Identitätsprüfung wird gespeichert …";

export const VIDEO_USE_APPROVAL_SAVING_LABEL =
  "Video-Freigabe wird gespeichert …";

export type PersonaMutationReconcileResult = {
  saved: true;
  refreshWarning: string | null;
};

export async function reconcileAfterPersonaMutation<TPanelState>(input: {
  reloadPersona: () => Promise<void>;
  reloadPanelState: () => Promise<TPanelState | null>;
  applyPanelState: (state: TPanelState) => void;
}): Promise<PersonaMutationReconcileResult> {
  let personaReloadFailed = false;
  let panelReloadFailed = false;

  try {
    await input.reloadPersona();
  } catch {
    personaReloadFailed = true;
  }

  try {
    const panelState = await input.reloadPanelState();
    if (panelState == null) {
      panelReloadFailed = true;
    } else {
      input.applyPanelState(panelState);
    }
  } catch {
    panelReloadFailed = true;
  }

  return {
    saved: true,
    refreshWarning:
      personaReloadFailed || panelReloadFailed
        ? PERSONA_MUTATION_REFRESH_WARNING
        : null,
  };
}
