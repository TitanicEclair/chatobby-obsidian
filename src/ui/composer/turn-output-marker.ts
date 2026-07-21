import type { FrontendFeedBlock } from "../../vendor/chatobby-client/frontend-contracts.js";

/** Track only events that commit a submitted prompt to ordinary cancellation semantics. */
export function turnOutputMarker(blocks: readonly FrontendFeedBlock[]): string {
  let count = 0;
  let last = "";
  for (const block of blocks) {
    const signature = committedBlockSignature(block);
    if (!signature) continue;
    count += 1;
    last = signature;
  }
  return `${count}:${last}`;
}

function committedBlockSignature(block: FrontendFeedBlock): string | null {
  switch (block.type) {
    case "user":
    case "system":
    case "queued":
    case "divider":
    case "agent-activity":
    case "message":
    case "notice":
      return null;
    case "text":
    case "thinking":
      return block.phase === "streaming" ? null : `${block.type}:${block.id}:${block.phase}`;
    case "tools": {
      const toolStarted = block.items.some((item) => item.phase !== "queued");
      return block.phase === "streaming" && !toolStarted ? null : `${block.type}:${block.id}:${block.phase}`;
    }
    case "summary": return `${block.type}:${block.id}:${block.blocks.length}:${block.durationMs ?? 0}`;
  }
}
