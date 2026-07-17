import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../../../ui/shared/component";

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
  private agents: readonly SessionAgentRailItem[] = [];
  private activeActorId = "main";

  constructor(private readonly options: SessionAgentRailOptions) {
    super();
  }

  setAgents(agents: readonly SessionAgentRailItem[]): void {
    this.agents = [...agents].sort(compareAgents);
    this.renderContent();
  }

  setActiveActor(actorId: string): void {
    this.activeActorId = actorId;
    this.renderContent();
  }

  protected onRender(): void {
    this.renderContent();
  }

  protected componentClass(): string {
    return "chatobby-session-agent-rail";
  }

  private renderContent(): void {
    if (!this.container) return;
    this.container.empty();
    this.container.toggleClass("is-hidden", this.agents.length <= 1);
    if (this.agents.length <= 1) return;

    const list = this.container.createDiv({
      cls: "chatobby-session-agent-rail__list",
      attr: { role: "tablist", "aria-label": "Agents in this session" },
    });
    const visibleAgents = this.agents.slice(0, 12);
    const activeAgent = this.agents.find((agent) => agent.actorId === this.activeActorId);
    if (activeAgent && !visibleAgents.some((agent) => agent.actorId === activeAgent.actorId)) {
      visibleAgents[visibleAgents.length - 1] = activeAgent;
      visibleAgents.sort(compareAgents);
    }
    for (const agent of visibleAgents) {
      const active = agent.actorId === this.activeActorId;
      const button = list.createEl("button", {
        cls: "chatobby-session-agent-rail__item",
        attr: {
          type: "button",
          role: "tab",
          "aria-selected": String(active),
          "aria-current": active ? "page" : null,
          "aria-busy": String(agent.working),
          title: `Open ${agent.name} feed`,
        },
      });
      button.toggleClass("is-active", active);
      if (agent.working) {
        const spinner = button.createSpan({ cls: "chatobby-session-agent-rail__spinner", attr: { "aria-hidden": "true" } });
        setIcon(spinner, "loader-circle");
      }
      button.createSpan({ cls: "chatobby-session-agent-rail__name", text: agent.name });
      button.addEventListener("click", () => {
        if (agent.kind === "main") this.options.openMainAgent();
        else if (agent.runId && agent.nodeId) this.options.openAgentFeed(agent.runId, agent.nodeId);
      });
    }
    if (this.agents.length > visibleAgents.length) {
      const more = list.createEl("button", {
        cls: "chatobby-session-agent-rail__more clickable-icon",
        attr: { type: "button", "aria-label": "Open agent history", title: "Open agent history" },
      });
      setIcon(more, "ellipsis");
      more.addEventListener("click", () => this.options.openAgentHistory());
    }
  }
}

function compareAgents(left: SessionAgentRailItem, right: SessionAgentRailItem): number {
  if (left.kind !== right.kind) return left.kind === "main" ? -1 : 1;
  return right.updatedAt - left.updatedAt || left.actorId.localeCompare(right.actorId);
}
