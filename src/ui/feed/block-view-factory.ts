import type { FeedBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { DividerBlockView } from "./divider-block";
import { ExtensionPanelBlockView } from "./extension-panel-block";
import type { FeedHost } from "./index";
import { QueuedMessageBlockView } from "./queued-message-block";
import { SubagentCommunicationBlockView } from "./subagent-communication-block";
import { TextBlockView } from "./text-block";
import { ThinkingBlockView } from "./thinking-block";
import { ToolBlockView } from "./tools/tool-block";
import { TurnSummaryView } from "./turn-summary";
import { UserBlockView } from "./user-block";

/** Keep keyed feed-view selection separate from the renderer lifecycle. */
export function canReuseBlockView(block: FeedBlock, view: unknown): boolean {
	switch (block.type) {
		case "user":
		case "system": return view instanceof UserBlockView;
		case "text": return view instanceof TextBlockView;
		case "thinking": return view instanceof ThinkingBlockView;
		case "tools": return view instanceof ToolBlockView;
		case "summary": return view instanceof TurnSummaryView;
		case "queued": return view instanceof QueuedMessageBlockView;
		case "divider": return view instanceof DividerBlockView;
		default: return false;
	}
}

export function updateBlockView(view: unknown, block: FeedBlock): void {
	switch (block.type) {
		case "text": (view as TextBlockView).setBlock(block); return;
		case "thinking": (view as ThinkingBlockView).setBlock(block); return;
		case "tools": (view as ToolBlockView).setBlock(block); return;
		case "summary": (view as TurnSummaryView).setSummary(block); return;
		case "user":
		case "system": (view as UserBlockView).setMessage(block.message, block.type); return;
		case "queued": (view as QueuedMessageBlockView).setBlock(block); return;
		case "divider": (view as DividerBlockView).setBlock(block); return;
	}
}

export function createBlockView(host: FeedHost, block: FeedBlock): ChatobbyComponent {
	switch (block.type) {
		case "user": case "system": return new UserBlockView(host);
		case "text": return new TextBlockView(host, block);
		case "thinking": return new ThinkingBlockView(host, block);
		case "tools": return new ToolBlockView(host, block);
		case "summary": return new TurnSummaryView(host, block);
		case "queued": return new QueuedMessageBlockView(host, block);
		case "divider": return new DividerBlockView(block);
		case "subagent": throw new Error("Subagent lifecycle blocks belong in the agent rail");
		case "subagent-communication": return new SubagentCommunicationBlockView(block, host);
		case "extension-panel": return new ExtensionPanelBlockView(host, block);
	}
}
