import type { FrontendFeedBlock } from "../../vendor/chatobby-client/frontend-contracts.js";

/** Track visible non-user feed progress without treating the submitted prompt itself as output. */
export function turnOutputMarker(blocks: readonly FrontendFeedBlock[]): string {
  let count = 0;
  let last = "";
  for (const block of blocks) {
    if (block.type === "user") continue;
    count += 1;
    last = feedBlockProgressSignature(block);
  }
  return `${count}:${last}`;
}

function feedBlockProgressSignature(block: FrontendFeedBlock): string {
  switch (block.type) {
    case "user": return "";
    case "system": return `${block.type}:${block.id}:${block.text.length}:${block.text.slice(-32)}`;
    case "text":
    case "thinking": return `${block.type}:${block.id}:${block.phase}:${block.text.length}:${block.text.slice(-32)}`;
    case "tools": return `${block.type}:${block.id}:${block.phase}:${block.items.map((item) =>
      `${item.id}:${item.phase}:${item.resultSummary?.length ?? 0}`).join(",")}`;
    case "summary": return `${block.type}:${block.id}:${block.blocks.length}:${block.durationMs ?? 0}`;
    case "queued": return `${block.type}:${block.id}:${block.phase}:${block.text.length}`;
    case "compaction": return `${block.type}:${block.id}:${block.phase}:${block.detail?.length ?? 0}`;
    case "agent-activity": return `${block.type}:${block.id}:${block.phase}:${block.detail?.length ?? 0}`;
    case "message": return `${block.type}:${block.id}:${block.timestamp}:${block.text.length}`;
    case "notice": return `${block.type}:${block.id}:${block.level}:${block.body.length}:${block.actions.length}`;
  }
}
