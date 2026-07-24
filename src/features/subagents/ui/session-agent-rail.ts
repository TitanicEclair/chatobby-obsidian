import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { reconcileKeyed } from "../../../ui/shared/page-shell";

export interface SessionAgentRailOptions {
  openMainAgent: () => void;
  openAgentFeed: (runId: string, nodeId: string) => void;
  openAgentHistory: () => void;
}

export interface SessionAgentRailItem {
  actorId: string;
  kind: "main" | "subagent";
  name: string;
  working: boolean;
  updatedAt: number;
  runId?: string;
  nodeId?: string;
}

/** Session-scoped agent switcher containing the main agent and live child agents. */
export class SessionAgentRail extends ChatobbyComponent {
  private sourceAgents: readonly SessionAgentRailItem[] = [];
  private agents: readonly SessionAgentRailItem[] = [];
  private readonly knownAgents = new Map<string, SessionAgentRailItem>();
  private readonly stableOrder = new Map<string, number>();
  private nextOrder = 0;
  private activeActorId = "main";
  private list: HTMLElement | null = null;
  private moreButton: HTMLButtonElement | null = null;
  private overflow: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private revealActive = false;
  private outsidePointerListener: ((event: PointerEvent) => void) | null = null;

  constructor(private readonly options: SessionAgentRailOptions) {
    super();
  }

  setAgents(agents: readonly SessionAgentRailItem[]): void {
    this.sourceAgents = [...agents];
    for (const agent of agents) {
      this.knownAgents.set(agent.actorId, agent);
      if (!this.stableOrder.has(agent.actorId)) {
        this.stableOrder.set(agent.actorId, this.nextOrder);
        this.nextOrder += 1;
      }
    }
    this.rebuildAgents();
  }

  setActiveActor(actorId: string): void {
    this.revealActive = actorId !== this.activeActorId;
    this.activeActorId = actorId;
    this.rebuildAgents();
  }

  override destroy(): void {
    this.closeOverflow();
    this.list = null;
    this.moreButton = null;
    super.destroy();
  }

  protected onRender(container: HTMLElement): void {
    this.list = container.createDiv({
      cls: "chatobby-session-agent-rail__list",
      attr: { role: "tablist", "aria-label": "Agents in this session" },
    });
    this.moreButton = container.createEl("button", {
      cls: "chatobby-session-agent-rail__more clickable-icon is-hidden",
      attr: {
        type: "button",
        "aria-label": "Find agents and open history",
        "aria-expanded": "false",
        title: "Find agents and open history",
      },
    });
    setIcon(this.moreButton, "ellipsis");
    this.moreButton.addEventListener("click", () => this.toggleOverflow());
    this.updateContent();
  }

  protected componentClass(): string {
    return "chatobby-session-agent-rail";
  }

  private updateContent(): void {
    const container = this.container;
    const list = this.list;
    if (!container || !list) return;
    container.toggleClass("is-hidden", this.agents.length <= 1);
    if (this.agents.length <= 1) {
      list.empty();
      this.moreButton?.addClass("is-hidden");
      this.closeOverflow();
      return;
    }
    const visibleAgents = this.agents.slice(0, 12);
    const activeAgent = this.agents.find((agent) => agent.actorId === this.activeActorId);
    if (activeAgent && !visibleAgents.some((agent) => agent.actorId === activeAgent.actorId)) {
      visibleAgents[visibleAgents.length - 1] = activeAgent;
      visibleAgents.sort((left, right) => this.compareAgents(left, right));
    }
    reconcileKeyed(
      list,
      visibleAgents,
      (agent) => agent.actorId,
      (agent) => this.createAgentButton(agent),
      (element, agent) => this.updateAgentButton(element as HTMLButtonElement, agent),
    );
    this.moreButton?.removeClass("is-hidden");
    if (this.overflow) this.renderOverflowResults();
    if (this.revealActive) {
      this.revealActive = false;
      const activeButton = list.querySelector<HTMLElement>(".chatobby-session-agent-rail__item.is-active");
      activeButton?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }

  private rebuildAgents(): void {
    const currentIds = new Set(this.sourceAgents.map((agent) => agent.actorId));
    for (const actorId of this.knownAgents.keys()) {
      if (!currentIds.has(actorId) && actorId !== this.activeActorId) {
        this.knownAgents.delete(actorId);
        this.stableOrder.delete(actorId);
      }
    }
    const agents = [...this.sourceAgents];
    if (this.activeActorId !== "main" && !currentIds.has(this.activeActorId)) {
      const retained = this.knownAgents.get(this.activeActorId) ?? fallbackActiveAgent(this.activeActorId);
      if (retained) {
        const available = { ...retained, working: false };
        this.knownAgents.set(available.actorId, available);
        if (!this.stableOrder.has(available.actorId)) {
          this.stableOrder.set(available.actorId, this.nextOrder);
          this.nextOrder += 1;
        }
        agents.push(available);
      }
    }
    this.agents = agents.sort((left, right) => this.compareAgents(left, right));
    this.updateContent();
  }

  private compareAgents(left: SessionAgentRailItem, right: SessionAgentRailItem): number {
    if (left.kind !== right.kind) return left.kind === "main" ? -1 : 1;
    return (this.stableOrder.get(left.actorId) ?? 0) - (this.stableOrder.get(right.actorId) ?? 0);
  }

  private createAgentButton(agent: SessionAgentRailItem): HTMLButtonElement {
    if (!this.list) throw new Error("Agent rail is not mounted");
    const button = this.list.createEl("button");
    button.className = "chatobby-session-agent-rail__item";
    button.type = "button";
    button.setAttribute("role", "tab");
    button.dataset.actorId = agent.actorId;
    button.addEventListener("click", () => this.openAgent(button.dataset.actorId ?? ""));
    button.addEventListener("keydown", (event) => this.handleAgentKeydown(event, button.dataset.actorId ?? ""));
    return button;
  }

  private updateAgentButton(button: HTMLButtonElement, agent: SessionAgentRailItem): void {
    const active = agent.actorId === this.activeActorId;
    button.empty();
    button.dataset.actorId = agent.actorId;
    button.toggleClass("is-active", active);
    button.setAttr("aria-selected", String(active));
    button.setAttr("aria-current", active ? "page" : null);
    button.setAttr("aria-busy", String(agent.working));
    button.setAttr("aria-label", agent.working ? `${agent.name}, working` : agent.name);
    button.setAttr("title", `Open ${agent.name} feed`);
    button.tabIndex = active ? 0 : -1;
    if (agent.working) {
      const spinner = button.createSpan({
        cls: "chatobby-session-agent-rail__spinner",
        attr: { "aria-hidden": "true" },
      });
      setIcon(spinner, "loader-circle");
    }
    button.createSpan({ cls: "chatobby-session-agent-rail__name", text: agent.name });
  }

  private handleAgentKeydown(event: KeyboardEvent, actorId: string): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const visible = Array.from(this.list?.querySelectorAll<HTMLButtonElement>(".chatobby-session-agent-rail__item") ?? []);
    const current = visible.findIndex((button) => button.dataset.actorId === actorId);
    if (current < 0 || visible.length === 0) return;
    event.preventDefault();
    const index = event.key === "Home"
      ? 0
      : event.key === "End"
        ? visible.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length;
    const next = visible[index];
    if (!next) return;
    next.focus();
    this.openAgent(next.dataset.actorId ?? "");
  }

  private openAgent(actorId: string): void {
    const agent = this.agents.find((candidate) => candidate.actorId === actorId);
    if (!agent) return;
    this.closeOverflow();
    if (agent.kind === "main") this.options.openMainAgent();
    else if (agent.runId && agent.nodeId) this.options.openAgentFeed(agent.runId, agent.nodeId);
  }

  private toggleOverflow(): void {
    if (this.overflow) {
      this.closeOverflow();
      return;
    }
    const container = this.container;
    if (!container) return;
    this.overflow = container.createDiv({
      cls: "chatobby-session-agent-rail__overflow",
      attr: { role: "dialog", "aria-label": "Find an agent" },
    });
    this.overflow.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.closeOverflow();
      this.moreButton?.focus();
    });
    this.searchInput = this.overflow.createEl("input", {
      cls: "chatobby-session-agent-rail__search",
      attr: { type: "search", placeholder: "Find an agent", "aria-label": "Find an agent" },
    });
    this.searchInput.addEventListener("input", () => this.renderOverflowResults());
    this.overflow.createDiv({ cls: "chatobby-session-agent-rail__overflow-results" });
    const history = this.overflow.createEl("button", {
      cls: "chatobby-session-agent-rail__history",
      text: "Open subagent history",
      attr: { type: "button" },
    });
    history.addEventListener("click", () => {
      this.closeOverflow();
      this.options.openAgentHistory();
    });
    this.moreButton?.setAttr("aria-expanded", "true");
    this.outsidePointerListener = (event) => {
      const target = event.target;
      const NodeConstructor = container.ownerDocument.defaultView?.Node;
      if (!NodeConstructor || !(target instanceof NodeConstructor)) return;
      if (this.overflow?.contains(target) || this.moreButton?.contains(target)) return;
      this.closeOverflow();
    };
    container.ownerDocument.addEventListener("pointerdown", this.outsidePointerListener, true);
    this.renderOverflowResults();
    this.searchInput.focus();
  }

  private renderOverflowResults(): void {
    const results = this.overflow?.querySelector<HTMLElement>(".chatobby-session-agent-rail__overflow-results");
    if (!results) return;
    results.empty();
    const query = this.searchInput?.value.trim().toLowerCase() ?? "";
    const matching = this.agents.filter((agent) => !query || agent.name.toLowerCase().includes(query));
    for (const [label, agents] of [
      ["Working", matching.filter((agent) => agent.working)],
      ["Available", matching.filter((agent) => !agent.working)],
    ] as const) {
      if (agents.length === 0) continue;
      results.createDiv({ cls: "chatobby-session-agent-rail__overflow-label", text: label });
      for (const agent of agents) {
        const button = results.createEl("button", {
          cls: "chatobby-session-agent-rail__overflow-item",
          attr: {
            type: "button",
            "aria-current": agent.actorId === this.activeActorId ? "page" : null,
            "aria-label": agent.working ? `${agent.name}, working` : agent.name,
          },
        });
        button.toggleClass("is-active", agent.actorId === this.activeActorId);
        if (agent.working) {
          const spinner = button.createSpan({
            cls: "chatobby-session-agent-rail__spinner",
            attr: { "aria-hidden": "true" },
          });
          setIcon(spinner, "loader-circle");
        }
        button.createSpan({ cls: "chatobby-session-agent-rail__overflow-name", text: agent.name });
        button.addEventListener("click", () => this.openAgent(agent.actorId));
      }
    }
    if (matching.length === 0) {
      results.createDiv({ cls: "chatobby-session-agent-rail__overflow-empty", text: "No matching agents" });
    }
  }

  private closeOverflow(): void {
    const ownerDocument = this.container?.ownerDocument;
    if (ownerDocument && this.outsidePointerListener) {
      ownerDocument.removeEventListener("pointerdown", this.outsidePointerListener, true);
    }
    this.outsidePointerListener = null;
    this.overflow?.remove();
    this.overflow = null;
    this.searchInput = null;
    this.moreButton?.setAttr("aria-expanded", "false");
  }
}

function fallbackActiveAgent(actorId: string): SessionAgentRailItem | null {
  const [kind, runId, ...nodeIdParts] = actorId.split(":");
  const nodeId = nodeIdParts.join(":");
  if (kind !== "subagent" || !runId || !nodeId) return null;
  return {
    actorId,
    kind: "subagent",
    name: "Current agent",
    working: false,
    updatedAt: 0,
    runId,
    nodeId,
  };
}
