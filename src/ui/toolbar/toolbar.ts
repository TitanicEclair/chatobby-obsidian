// Toolbar — connection status dot + a live token/context meter (from getSessionStats).
// The old "Ready"/"Generating" text box is gone: the dot conveys connection (and pulses while
// streaming), and the meter shows something actually useful — tokens used and how full the
// context window is. The session NAME lives in the tab bar, not here.
//
// Rendering discipline (see docs/frontend-architecture-refactor.md):
//   - The stats subtree is built ONCE and updated in place. renderStats() mutates cached child
//     elements (textContent + CSS custom properties) instead of empty()+rebuild.
//   - renderFlags() (dot + streaming/compacting classes + aria-label) is cheap and no-ops when
//     nothing changed — safe to call on every agent event.
//   - The elapsed timer ticks renderStats() at ELAPSED_UPDATE_MS; that's fine because it's an
//     in-place update, not a subtree teardown.

import { feedSelectors, type FeedStore } from "../../features/feed/public";
import type { ConnectionState, SessionState, WsAutoCompactionSettings, WsSessionStats } from "../../types";
import type { RuntimeLifecycleState } from "../../runtime/public";
import { ChatobbyComponent } from "../shared/component";
import { formatDuration } from "../shared/format";
import { setConnectionIndicator } from "../shell/view-shell";

/** Host interface — the view provides these to the toolbar. */
export interface ToolbarHost {
  getConnectionState(): ConnectionState;
  getRuntimeState(): RuntimeLifecycleState;
  getSessionState(): SessionState | null;
  getStats(): WsSessionStats | null;
  getFeedStore(): FeedStore;
  getAutoCompactionSettings(): WsAutoCompactionSettings;
  toggleAutoCompaction(): Promise<void>;
  openAutoCompaction(): void;
}

export class Toolbar extends ChatobbyComponent {
  private connectionEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  /** Cached stats children — created once, mutated in place thereafter. */
  private elapsedEl: HTMLSpanElement | null = null;
  private meterEl: HTMLButtonElement | null = null;
  private contextMenuEl: HTMLElement | null = null;
  private emptyEl: HTMLSpanElement | null = null;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  /** Last rendered connection status — skip class-list churn when unchanged. */
  private lastConnStatus: string | null = null;
  private wasCompacting = false;
  private compactionCompleted = false;
  private compactionCompletionTimer: ReturnType<typeof setTimeout> | null = null;
  private documentListenersBound = false;
  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node) || this.contextMenuEl?.contains(target) || this.meterEl?.contains(target)) return;
    this.closeContextMenu();
  };
  private readonly handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.closeContextMenu();
  };

  constructor(private host: ToolbarHost) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-toolbar";
  }

  protected onRender(_container: HTMLElement): void {
    // Toolbar DOM is built by ViewShell; this component only updates dot + stats.
    this.renderStatus();
  }

  /** Bind to pre-built shell elements (from ViewShell). */
  bind(connectionEl: HTMLElement, statsEl: HTMLElement): void {
    this.connectionEl = connectionEl;
    this.statsEl = statsEl;
    this.lastConnStatus = null; // force re-set classes after a rebind
    if (!this.documentListenersBound) {
      document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
      document.addEventListener("keydown", this.handleDocumentKeydown, true);
      this.documentListenersBound = true;
    }
    this.renderStatus();
  }

  /** Full refresh: flags + stats. Use on bind, tab switch, stats load, connection change. */
  renderStatus(): void {
    this.renderFlags();
    this.renderStats();
  }

  /** Cheap flag update — connection dot + streaming/compacting classes + aria-label.
   *  Safe to call on every agent event; no-ops when nothing changed. Does NOT touch the stats
   *  subtree, so it does not cause layout/style thrash during streaming. */
  renderFlags(): void {
    const conn = this.host.getConnectionState();
    const runtime = this.host.getRuntimeState();
    const session = this.host.getSessionState();
    if (this.connectionEl) {
      const status = indicatorStatus(runtime, conn);
      if (this.lastConnStatus !== status) {
        setConnectionIndicator(this.connectionEl, status);
        this.lastConnStatus = status;
      }
      this.connectionEl.toggleClass("is-streaming", session?.isStreaming === true);
      this.connectionEl.toggleClass("is-compacting", session?.isCompacting === true);
      this.connectionEl.setAttribute("aria-label", this.dotLabel(runtime, conn, session));
    }
    this.syncCompactionStatus(session?.isCompacting === true);
    this.syncElapsedTimer();
  }

  /** In-place stats update. Builds the elapsed span / context meter once, then mutates their
   *  text content and CSS custom properties. No subtree teardown, so it is cheap to run on the
   *  elapsed timer (every ELAPSED_UPDATE_MS) and on stats polls. */
  private renderStats(): void {
    if (!this.statsEl) return;
    const stats = this.host.getStats();
    const elapsed = this.elapsedMs();
    const context = stats?.contextUsage;
    const pct = context && typeof context.percent === "number"
      ? Math.max(0, Math.min(100, context.percent))
      : null;

    // Elapsed label — create/remove as the run starts/stops, update text in place.
    if (elapsed != null) {
      if (!this.elapsedEl) {
        this.elapsedEl = this.statsEl.createSpan({ cls: "chatobby-toolbar__stats-elapsed" });
        // Keep elapsed visually before the meter if the meter already exists.
        if (this.meterEl) this.statsEl.insertBefore(this.elapsedEl, this.meterEl);
      }
      this.elapsedEl.textContent = formatDuration(elapsed);
    } else if (this.elapsedEl) {
      this.elapsedEl.remove();
      this.elapsedEl = null;
    }

    // Context meter — available for every active session, even while the first stats request is
    // still loading. It is both the usage indicator and the automatic-compaction control.
    const hasSession = this.host.getSessionState()?.sessionId != null;
    if ((stats && pct != null) || hasSession) {
      if (!this.meterEl) {
        this.meterEl = this.statsEl.createEl("button", {
          cls: "chatobby-context-meter",
          attr: {
            type: "button",
            "aria-haspopup": "dialog",
            "aria-expanded": "false",
            "aria-label": "Context usage and automatic compaction",
          },
        });
        this.meterEl.addEventListener("click", () => this.toggleContextMenu());
      }
      const currentPct = pct ?? 0;
      this.meterEl.setCssProps({
        "--chatobby-context-pct": `${currentPct}%`,
        "--chatobby-context-angle": `${currentPct * 3.6}deg`,
      });
      this.meterEl.toggleClass("is-high", currentPct >= 80);
      this.meterEl.toggleClass("is-unavailable", pct == null);
      this.meterEl.toggleClass("is-running", this.host.getSessionState()?.isCompacting === true);
      this.meterEl.toggleClass("is-complete", this.compactionCompleted);
      const tokens = context?.tokens ?? stats?.tokens.total ?? null;
      const ctxWindow = context?.contextWindow;
      this.meterEl.setAttr("title", pct == null ? "Context usage is loading" : meterTooltip(tokens ?? 0, ctxWindow, pct));
      this.renderContextMenu(stats, pct);
    } else if (this.meterEl) {
      this.closeContextMenu();
      this.contextMenuEl?.remove();
      this.contextMenuEl = null;
      this.meterEl.remove();
      this.meterEl = null;
    }

    // Empty-state dash only when nothing else is shown.
    const isEmpty = elapsed == null && pct == null && !hasSession;
    if (isEmpty && !this.emptyEl) {
      this.emptyEl = this.statsEl.createSpan({ cls: "chatobby-toolbar__stats-empty", text: "—" });
    } else if (!isEmpty && this.emptyEl) {
      this.emptyEl.remove();
      this.emptyEl = null;
    }
  }

  destroy(): void {
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    if (this.compactionCompletionTimer) clearTimeout(this.compactionCompletionTimer);
    this.elapsedTimer = null;
    this.compactionCompletionTimer = null;
    this.elapsedEl = null;
    this.meterEl = null;
    this.contextMenuEl = null;
    this.emptyEl = null;
    this.lastConnStatus = null;
    if (this.documentListenersBound) {
      document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
      document.removeEventListener("keydown", this.handleDocumentKeydown, true);
      this.documentListenersBound = false;
    }
    super.destroy();
  }

  private toggleContextMenu(): void {
    if (!this.meterEl) return;
    const open = this.contextMenuEl?.hasClass("is-open") !== true;
    this.contextMenuEl?.toggleClass("is-open", open);
    this.meterEl.setAttr("aria-expanded", String(open));
  }

  private closeContextMenu(): void {
    this.contextMenuEl?.removeClass("is-open");
    this.meterEl?.setAttr("aria-expanded", "false");
  }

  private renderContextMenu(stats: WsSessionStats | null, pct: number | null): void {
    if (!this.statsEl) return;
    if (!this.contextMenuEl) {
      this.contextMenuEl = this.statsEl.createDiv({
        cls: "chatobby-context-menu",
        attr: { role: "dialog", "aria-label": "Context and automatic compaction" },
      });
    }
    const wasOpen = this.contextMenuEl.hasClass("is-open");
    this.contextMenuEl.empty();
    this.contextMenuEl.toggleClass("is-open", wasOpen);
    this.contextMenuEl.createDiv({ cls: "chatobby-context-menu__title", text: "Context" });
    this.contextMenuEl.createDiv({
      cls: "chatobby-context-menu__usage",
      text: pct == null ? "Usage is loading" : `${Math.round(pct)}% used`,
    });
    const context = stats?.contextUsage;
    if (context?.contextWindow) {
      this.contextMenuEl.createDiv({
        cls: "chatobby-context-menu__tokens",
        text: `${formatTokens(context.tokens ?? stats?.tokens.total ?? 0)} of ${formatTokens(context.contextWindow)} tokens`,
      });
    }

    const settings = this.host.getAutoCompactionSettings();
    const compaction = this.contextMenuEl.createDiv({ cls: "chatobby-context-menu__compaction" });
    const row = compaction.createDiv({ cls: "chatobby-context-menu__row" });
    row.createSpan({ text: "Automatic compaction" });
    const toggle = row.createEl("button", {
      cls: `chatobby-context-menu__toggle${settings.enabled ? " is-enabled" : ""}`,
      text: settings.enabled ? "On" : "Off",
      attr: { type: "button", "aria-pressed": String(settings.enabled) },
    });
    toggle.addEventListener("click", () => { void this.host.toggleAutoCompaction(); });
    compaction.createDiv({
      cls: "chatobby-context-menu__threshold",
      text: `Starts at ${settings.thresholdPercent}%${settings.effectiveThresholdPercent < settings.thresholdPercent ? ` · safety-adjusted to ${settings.effectiveThresholdPercent}%` : ""}`,
    });
    compaction.createDiv({
      cls: `chatobby-context-menu__state${this.host.getSessionState()?.isCompacting ? " is-running" : this.compactionCompleted ? " is-complete" : ""}`,
      text: this.host.getSessionState()?.isCompacting
        ? "Compacting context now"
        : this.compactionCompleted
          ? "Compaction complete"
          : "Ready when the threshold is reached",
    });
    const configure = this.contextMenuEl.createEl("button", {
      cls: "chatobby-context-menu__configure",
      text: "Configure compaction",
      attr: { type: "button" },
    });
    configure.addEventListener("click", () => {
      this.closeContextMenu();
      this.host.openAutoCompaction();
    });
  }

  private syncCompactionStatus(running: boolean): void {
    if (this.wasCompacting && !running) {
      this.compactionCompleted = true;
      if (this.compactionCompletionTimer) clearTimeout(this.compactionCompletionTimer);
      this.compactionCompletionTimer = setTimeout(() => {
        this.compactionCompletionTimer = null;
        this.compactionCompleted = false;
        this.renderStats();
      }, 3_000);
    } else if (running) {
      this.compactionCompleted = false;
    }
    this.wasCompacting = running;
  }

  private elapsedMs(): number | null {
    const runStartedAt = this.host.getFeedStore().select(feedSelectors.runTiming).runStartedAt;
    if (runStartedAt != null) return Math.max(0, Date.now() - runStartedAt);
    return null;
  }

  private syncElapsedTimer(): void {
    const active = this.host.getFeedStore().select(feedSelectors.runTiming).runStartedAt != null;
    if (active && !this.elapsedTimer) {
      // Render once so the elapsed element exists immediately when a run starts.
      this.renderStats();
      this.elapsedTimer = setInterval(() => this.renderStats(), ELAPSED_UPDATE_MS);
    } else if (!active && this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  private dotLabel(runtime: RuntimeLifecycleState, conn: ConnectionState, session: SessionState | null): string {
    if (session?.isCompacting) return "Compacting context";
    if (session?.isStreaming) return "Generating";
    if (runtime.status === "error") return `Chatobby runtime error: ${runtime.diagnostics.message}`;
    if (runtime.status === "crash_loop") return "Chatobby automatic restart paused";
    if (runtime.status !== "ready") return `Chatobby runtime: ${runtime.status}`;
    return `Connection: ${conn.status}`;
  }
}

const ELAPSED_UPDATE_MS = 500;

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function meterTooltip(tokens: number, contextWindow: number | undefined, pct: number): string {
  const parts = [`${formatTokens(tokens)} / ${formatTokens(contextWindow ?? 0)} tokens`];
  parts.push(`Context window ${Math.round(pct)}% full`);
  return parts.join("\n");
}

function indicatorStatus(runtime: RuntimeLifecycleState, connection: ConnectionState): string {
  switch (runtime.status) {
    case "error":
    case "crash_loop":
      return "error";
    case "resolving":
    case "spawning":
    case "authenticating":
    case "stopping":
      return "connecting";
    case "ready":
      return connection.status;
    case "idle":
    case "detached":
      return "disconnected";
  }
}
