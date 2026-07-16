import type { FeedTransaction } from "../feed-transaction";

/** Freeze presentation-only live state until the runtime can resynchronize it. */
export function reduceTransportInterruption(transaction: FeedTransaction): void {
  for (const id of transaction.orderedBlockIds()) {
    const block = transaction.getBlock(id);
    if ((block?.type === "thinking" || block?.type === "text" || block?.type === "tools") && block.status === "streaming") {
      transaction.updateBlock(id, (current) =>
        current.type === "thinking" || current.type === "text" || current.type === "tools"
          ? { ...current, status: "complete" }
          : current,
      );
    }
  }
  for (const id of transaction.allToolIds()) {
    const tool = transaction.getTool(id);
    if (!tool || (tool.status !== "pending" && tool.status !== "running" && tool.status !== "waiting")) continue;
    transaction.updateTool(id, (current) => ({ ...current, status: "interrupted", endTime: transaction.now() }));
  }
  transaction.completeRun();
}
