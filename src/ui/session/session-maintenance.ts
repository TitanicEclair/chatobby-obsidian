/** Advanced session operations exposed from a stored-session context menu. */
export type SessionAdvancedAction = "rename" | "clone" | "fork" | "export-html" | "export-jsonl";

/** Business callbacks required after the selected stored session is active. */
export type SessionMaintenanceActions = Record<SessionAdvancedAction, () => Promise<void>>;

/** Verify reattachment before applying a contextual mutation to a stored session. */
export async function runSessionAdvancedAction(
  activeSessionPath: string | undefined,
  selectedSessionPath: string,
  action: SessionAdvancedAction,
  actions: SessionMaintenanceActions,
): Promise<void> {
  if (normalizeSessionPath(activeSessionPath) !== normalizeSessionPath(selectedSessionPath)) {
    throw new Error("The selected session could not be resumed.");
  }
  await actions[action]();
}

function normalizeSessionPath(path: string | undefined): string {
  return (path ?? "").replaceAll("\\", "/").toLocaleLowerCase();
}
