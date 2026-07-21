export interface ConnectedViewRestorationOptions {
  isCurrent(): boolean;
  restoreSession(): Promise<void>;
  synchronizeFrontend(): Promise<void>;
  synchronizeActiveScreen(): void;
  markRestored(): void;
  reportSessionError(error: unknown): void;
  reportFrontendError(error: unknown): void;
}

/** Restore session identity before loading the active session-bound feature screen. */
export async function restoreConnectedView(options: ConnectedViewRestorationOptions): Promise<void> {
  let sessionRestored = false;
  try {
    await options.restoreSession();
    sessionRestored = true;
  } catch (error) {
    options.reportSessionError(error);
  }
  if (!options.isCurrent()) return;

  try {
    await options.synchronizeFrontend();
  } catch (error) {
    options.reportFrontendError(error);
    return;
  }
  if (!options.isCurrent()) return;

  options.synchronizeActiveScreen();
  if (sessionRestored) options.markRestored();
}

export interface ConnectedViewRestorationControllerOptions<Transport> {
  isCurrent(transport: Transport): boolean;
  restoreSession(): Promise<void>;
  synchronizeFrontend(transport: Transport): Promise<void>;
  synchronizeActiveScreen(): void;
  markRestored(): void;
  reportSessionError(error: unknown): void;
  reportFrontendError(error: unknown): void;
}

/** De-duplicate one connection restoration while allowing a later reconnect. */
export class ConnectedViewRestorationController<Transport> {
  private active: { transport: Transport; promise: Promise<void> } | null = null;

  constructor(private readonly options: ConnectedViewRestorationControllerOptions<Transport>) {}

  synchronize(transport: Transport): void {
    if (!this.options.isCurrent(transport) || this.active?.transport === transport) return;
    const promise = restoreConnectedView({
      isCurrent: () => this.options.isCurrent(transport),
      restoreSession: () => this.options.restoreSession(),
      synchronizeFrontend: () => this.options.synchronizeFrontend(transport),
      synchronizeActiveScreen: () => this.options.synchronizeActiveScreen(),
      markRestored: () => this.options.markRestored(),
      reportSessionError: (error) => this.options.reportSessionError(error),
      reportFrontendError: (error) => this.options.reportFrontendError(error),
    });
    const active = { transport, promise };
    this.active = active;
    void promise.finally(() => {
      if (this.active === active) this.active = null;
    });
  }

  invalidate(): void {
    this.active = null;
  }
}
