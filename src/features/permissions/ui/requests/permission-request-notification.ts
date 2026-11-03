import { Notice } from "obsidian";
import type { PermissionRequestReview } from "../../../../vendor/chatobby-client/permission-review";

const notified = new Set<string>();

/** A durable request can be visible in parent and child panes; notify once per operation. */
export function notifyPermissionRequestOnce(review: PermissionRequestReview): void {
  if (notified.has(review.requestId)) return;
  notified.add(review.requestId);
  if (notified.size > 256) { const oldest = [...notified][0]; if (oldest) notified.delete(oldest); }
  new Notice(`Chatobby needs permission for ${review.toolName}. Review the request above the composer.`);
}
