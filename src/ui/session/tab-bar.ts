import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";
import type { ChatobbyViewMode } from "../controller/view-navigation-controller";

export interface TabBarHost {
  sessionTitle(): string;
  workspaceLabel(): string;
  activeMode(): ChatobbyViewMode;
  onReturnToChat(): void;
  onCreateView(): void;
  onNavigate(mode: "projects" | "subagents" | "channels" | "permissions" | "memory" | "events" | "mcp" | "settings"): void;
  subagentHost?(): HTMLElement;
}

/** Conversation identity and a collapsed session agent switcher. Global pages live in the sidebar. */
export class TabBar extends ChatobbyComponent {
  private title: HTMLElement | null = null;
  private scope: HTMLElement | null = null;
  private dismiss: (() => void) | null = null;
  constructor(private readonly host: TabBarHost) { super(); }

  refresh(): void {
    if (this.title) this.title.textContent = this.host.sessionTitle();
    if (this.scope) this.scope.textContent = this.host.workspaceLabel();
  }

  override destroy(): void {
    this.dismiss?.(); this.dismiss = null;
    super.destroy();
  }

  protected componentClass(): string { return "chatobby-tab-bar"; }
  protected onRender(container: HTMLElement): void {
    const identity = container.createEl("button", { cls: "chatobby-tab-bar__directory", attr: { type: "button", "aria-label": "Return to main chat" } });
    this.title = identity.createSpan({ cls: "chatobby-tab-bar__session-title" });
    this.scope = identity.createSpan({ cls: "chatobby-tab-bar__workspace-label" });
    identity.addEventListener("click", () => this.host.onReturnToChat());
    const disclosure = container.createEl("details", { cls: "chatobby-agent-disclosure" });
    const summary = disclosure.createEl("summary", { attr: { "aria-label": "Session subagents" } });
    setIcon(summary.createSpan(), "bot");
    summary.createSpan({ text: "Subagents" });
    setIcon(summary.createSpan({ cls: "chatobby-agent-disclosure__chevron" }), "chevron-down");
    const panel = disclosure.createDiv({ cls: "chatobby-agent-disclosure__panel" });
    const agents = this.host.subagentHost?.();
    if (agents) panel.append(agents);
    const all = panel.createEl("button", { cls: "chatobby-agent-disclosure__all", text: "All agents and roles", attr: { type: "button" } });
    all.addEventListener("click", () => { disclosure.open = false; this.host.onNavigate("subagents"); });
    disclosure.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { disclosure.open = false; summary.focus(); event.stopPropagation(); }
    });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !disclosure.contains(event.target)) disclosure.open = false;
    };
    container.ownerDocument.addEventListener("pointerdown", outside);
    this.dismiss = () => container.ownerDocument.removeEventListener("pointerdown", outside);
    this.refresh();
  }
}
