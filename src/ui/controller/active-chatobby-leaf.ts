export interface ActiveChatobbyLeafActivationOptions {
  activateSessionContext(): Promise<void>;
  isCurrent(): boolean;
  synchronizeActiveScreen(): void;
  focusComposer(): void;
}

/**
 * Reconcile the leaf-owned session before reloading its active feature page.
 * The frontend bootstrap intentionally omits feature screen models, so the
 * page reload must happen after session reconciliation rather than racing it.
 */
export async function activateChatobbyLeaf(
  options: ActiveChatobbyLeafActivationOptions,
): Promise<void> {
  await options.activateSessionContext();
  if (!options.isCurrent()) return;
  options.synchronizeActiveScreen();
  options.focusComposer();
}
