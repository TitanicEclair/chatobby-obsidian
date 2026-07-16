import type { FrontendAgentRailViewModel } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { SessionAgentRail } from "../ui/session-agent-rail";

export interface SessionAgentRailControllerOptions {
  getActiveActorId: () => string;
  openMainAgent: () => void;
  openAgentFeed: (runId: string, nodeId: string) => void;
  openAgentHistory: () => void;
}

/** Binds runtime-projected rail items to native Obsidian navigation. */
export class SessionAgentRailController {
  private readonly view: SessionAgentRail;
  private model: FrontendAgentRailViewModel = { items: [] };

  constructor(private readonly options: SessionAgentRailControllerOptions) {
    this.view = new SessionAgentRail({
      openMainAgent: options.openMainAgent,
      openAgentFeed: options.openAgentFeed,
      openAgentHistory: options.openAgentHistory,
    });
  }

  render(host: HTMLElement): void {
    this.view.render(host);
    this.refresh();
  }

  setModel(model: FrontendAgentRailViewModel): void {
    this.model = model;
    this.refresh();
  }

  scheduleRefresh(): void {
    this.refresh();
  }

  clear(): void {
    this.model = { items: [] };
    this.refresh();
  }

  refresh(): void {
    this.view.setActiveActor(this.options.getActiveActorId());
    this.view.setAgents(this.model.items);
  }

  destroy(): void {
    this.view.destroy();
  }
}

export function subagentActorId(runId: string, nodeId: string): string {
  return `subagent:${runId}:${nodeId}`;
}
