import type { SessionState, WsSessionStats } from "../../types";
import type { ChatobbyTransport } from "../../transport/ws-client";
import { LIVE_STATS_POLL_MS } from "../shared/constants";

/** Dependencies required to poll session statistics without owning view state. */
export interface LiveStatsControllerOptions {
  getTransport: () => ChatobbyTransport | null | undefined;
  getSessionState: () => Pick<SessionState, "isStreaming" | "isCompacting">;
  onChange: (stats: WsSessionStats | null) => void;
}

/** Coalesces live-stat requests and owns the polling timer for one Chatobby view. */
export class LiveStatsController {
  private stats: WsSessionStats | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private queued = false;
  private disposed = false;
  private active = true;

  constructor(private readonly options: LiveStatsControllerOptions) {}

  current(): WsSessionStats | null {
    return this.stats;
  }

  /** Discard cached stats. Call on tab switch so a stale meter from the previous
   *  session never renders while the active session's stats are being fetched —
   *  the stats endpoint always queries the transport's current session, so a
   *  refresh right after the switch repopulates it for the now-active session. */
  reset(): void {
    this.stats = null;
  }

  async refresh(): Promise<void> {
    const transport = this.options.getTransport();
    if (this.disposed || !transport?.isConnected) return;
    if (this.inFlight) {
      this.queued = true;
      return;
    }
    this.inFlight = true;
    try {
      this.stats = await transport.getSessionStats();
      this.options.onChange(this.stats);
    } catch (error) {
      console.error("Chatobby: failed to load session stats", error);
    } finally {
      this.inFlight = false;
      if (this.queued && !this.disposed) {
        this.queued = false;
        void this.refresh();
      }
    }
  }

  start(): void {
    if (this.disposed || !this.active || this.timer !== null) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), LIVE_STATS_POLL_MS);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  sync(): void {
    const session = this.options.getSessionState();
    if (this.options.getTransport()?.isConnected && (session.isStreaming || session.isCompacting)) this.start();
    else this.stop();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (active) this.sync();
    else this.stop();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.queued = false;
  }
}
