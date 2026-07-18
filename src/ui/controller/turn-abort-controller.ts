interface AbortTransport {
  readonly isConnected: boolean;
  abort(): Promise<void>;
}

export interface TurnAbortControllerOptions {
  cancelInteractions: () => void;
  getTransport: () => AbortTransport | null;
  setStopping: (stopping: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  reportError: (error: unknown) => void;
}

/** Owns Stop request deduplication separately from the view and provider drain lifecycle. */
export class TurnAbortController {
  private pending = false;

  constructor(private readonly options: TurnAbortControllerOptions) {}

  request(): void {
    if (this.pending) return;
    this.options.cancelInteractions();
    const transport = this.options.getTransport();
    if (!transport?.isConnected) return;
    this.pending = true;
    this.options.setStopping(true);
    void transport.abort().catch((error) => {
      this.pending = false;
      this.options.setStopping(false);
      console.error("Chatobby: could not stop the current turn", error);
      this.options.reportError(error);
    });
  }

  setStreaming(streaming: boolean): void {
    if (!streaming) this.pending = false;
    this.options.setStreaming(streaming);
  }
}
