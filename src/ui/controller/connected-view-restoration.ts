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
    if (options.isCurrent()) options.reportSessionError(error);
  }
  if (!options.isCurrent()) return;

  try {
    await options.synchronizeFrontend();
  } catch (error) {
    if (options.isCurrent()) options.reportFrontendError(error);
    return;
  }
  if (!options.isCurrent()) return;

  options.synchronizeActiveScreen();
  if (sessionRestored) options.markRestored();
}

/** A capability for this authenticated connection epoch, not global runtime readiness. */
export interface ConnectedViewRestorationContext<Transport> {
  readonly transport: Transport;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}

/** Release only a retired connection's local wait; backend work is not cancelled. */
export async function waitForConnection<T>(work: () => Promise<T>, connection?: { readonly signal: AbortSignal }): Promise<T> {
  if (!connection) return work();
  const signal = connection.signal;
  if (signal.aborted) throw new Error("Chatobby connection changed while restoring this session.");
  let abort!: () => void;
  const retired = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new Error("Chatobby connection changed while restoring this session."));
    signal.addEventListener("abort", abort, { once: true });
  });
  try { return await Promise.race([work(), retired]); }
  finally { signal.removeEventListener("abort", abort); }
}

export interface ConnectedViewRestorationControllerOptions<Transport> {
  isCurrent(transport: Transport): boolean;
  restoreSession(context: ConnectedViewRestorationContext<Transport>): Promise<void>;
  synchronizeFrontend(transport: Transport): Promise<void>;
  synchronizeActiveScreen(): void;
  markRestored(): void;
  reportSessionError(error: unknown): void;
  reportFrontendError(error: unknown): void;
}

/** De-duplicate one connection restoration while allowing a later reconnect. */
export class ConnectedViewRestorationController<Transport> {
  private active: { transport: Transport; promise: Promise<void> } | null = null;
  private epoch = 0;
  private connection: { context: ConnectedViewRestorationContext<Transport>; abort: AbortController } | null = null;

  constructor(private readonly options: ConnectedViewRestorationControllerOptions<Transport>) {}

  currentConnection(transport: Transport): ConnectedViewRestorationContext<Transport> | null {
    if (!this.options.isCurrent(transport)) return null;
    if (this.connection?.context.transport === transport && this.connection.context.isCurrent()) return this.connection.context;
    this.connection?.abort.abort();
    const epoch = this.epoch;
    const abort = new AbortController();
    const context = { transport, signal: abort.signal, isCurrent: () => !abort.signal.aborted && epoch === this.epoch && this.options.isCurrent(transport) };
    this.connection = { context, abort };
    return context;
  }

  synchronize(transport: Transport): void {
    if (!this.options.isCurrent(transport) || this.active?.transport === transport) return;
    const context = this.currentConnection(transport);
    if (!context) return;
    const promise = restoreConnectedView({
      isCurrent: context.isCurrent,
      restoreSession: () => this.options.restoreSession(context),
      synchronizeFrontend: () => waitForConnection(() => this.options.synchronizeFrontend(transport), context),
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
    this.epoch += 1;
    this.connection?.abort.abort();
    this.connection = null;
    this.active = null;
  }
}
