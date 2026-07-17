import { setIcon } from "obsidian";
import type { SubagentActivity, SubagentBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { formatDuration } from "../shared/format";

export class SubagentBlockView extends ChatobbyComponent {
  constructor(private readonly block: SubagentBlock) {
    super();
  }

  protected onRender(container: HTMLElement): void {
    const activity = this.block.activity;
    container.toggleClass("is-running", activity.status === "running" || activity.status === "created" || activity.status === "steered");
    container.toggleClass("is-waiting", activity.status === "waiting");
    container.toggleClass("is-complete", activity.status === "completed");
    container.toggleClass("is-error", activity.status === "failed");

    const header = container.createDiv({ cls: "chatobby-subagent__header" });
	const working = activity.status === "running" || activity.status === "created" || activity.status === "steered";
	container.setAttr("aria-label", `${activity.name ?? activity.type}: ${statusLabel(activity)}`);
	if (working) {
		const iconEl = header.createSpan({ cls: "chatobby-subagent__icon is-spinning" });
		setIcon(iconEl, "loader-circle");
		iconEl.setAttr("role", "img");
		iconEl.setAttr("aria-label", statusLabel(activity));
		iconEl.setAttr("title", statusLabel(activity));
	}

    const titleEl = header.createDiv({ cls: "chatobby-subagent__title" });
    titleEl.createSpan({ cls: "chatobby-subagent__label", text: activity.name ?? activity.type });
    if (activity.description !== "Subagent activity") {
      titleEl.createSpan({ cls: "chatobby-subagent__description", text: activity.description });
    }
    if (activity.source === "chatobby-supervisor") {
      const open = header.createEl("button", {
        cls: "chatobby-subagent__open clickable-icon",
        attr: { type: "button", title: "Open agent feed", "aria-label": "Open agent feed" },
      });
      setIcon(open, "panel-right-open");
      open.addEventListener("click", () => {
        open.dispatchEvent(new CustomEvent("chatobby:open-subagents", {
          bubbles: true,
          detail: { runId: activity.agentId, feedOnly: true },
        }));
      });
      if (activity.errorMessage) {
        container.createDiv({ cls: "chatobby-subagent__detail is-error", text: activity.errorMessage });
      }
      return;
    }

    const meta = subagentMeta(activity);
    if (meta.length > 0) {
      const metaEl = container.createDiv({ cls: "chatobby-subagent__meta" });
      for (const item of meta) metaEl.createSpan({ cls: "chatobby-subagent__meta-item", text: item });
    }

    const detail = activity.errorMessage ?? activity.resultPreview ?? activity.lastSteer;
    if (detail) {
      container.createDiv({
        cls: activity.errorMessage ? "chatobby-subagent__detail is-error" : "chatobby-subagent__detail",
        text: detail,
      });
    }
  }

  protected componentClass(): string {
    return "chatobby-subagent";
  }
}

function statusLabel(activity: SubagentActivity): string {
  switch (activity.status) {
    case "created":
      return activity.isBackground ? "queued" : "created";
    case "running":
      return "running";
    case "waiting":
      return "waiting";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "steered":
      return "steered";
  }
}

function subagentMeta(activity: SubagentActivity): string[] {
  const parts: string[] = [];
  if (activity.durationMs != null) parts.push(formatDuration(activity.durationMs));
  if (activity.toolUses != null) parts.push(`${activity.toolUses} tool${activity.toolUses === 1 ? "" : "s"}`);
  if (activity.tokens) parts.push(`${activity.tokens.total} tokens`);
  if (activity.compactionCount > 0) parts.push(`${activity.compactionCount} compaction${activity.compactionCount === 1 ? "" : "s"}`);
  return parts;
}
