import type { FeedBlock } from "../../types";

export function transitionBlock(block: FeedBlock, event: "complete" | "compact"): FeedBlock {
  // Only text/thinking/tools blocks carry a BlockStatus; queued/compaction blocks have their own.
  if (block.type !== "text" && block.type !== "thinking" && block.type !== "tools") return block;
  const status = event === "complete" ? "complete" : "compacted";
  return { ...block, status };
}
