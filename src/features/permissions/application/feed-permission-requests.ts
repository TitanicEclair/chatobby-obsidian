import type { FrontendBootstrap } from "../../../vendor/chatobby-client/frontend-contracts";
import type { ProjectedPermissionRequests } from "./projected-permission-requests";

/** Keep child requests visible beside the parent draft while leaving durable notice history intact. */
export function synchronizeFeedPermissionRequests(
  presenter: ProjectedPermissionRequests,
  snapshot: FrontendBootstrap,
  getSnapshot: () => FrontendBootstrap | null,
  dispatchAction: (actionId: string) => Promise<void>,
): void {
  const binding = JSON.stringify([snapshot.runtimeInstanceId, snapshot.viewId, snapshot.session?.id]);
  presenter.update(binding, snapshot.feed.blocks.flatMap((block) => {
    if (block.type !== "notice" || !block.permissionRequest) return [];
    const allow = block.actions.find((action) => action.id.startsWith("subagent-permission:approve:"));
    const deny = block.actions.find((action) => action.id.startsWith("subagent-permission:deny:"));
    if (!allow || !deny) return [];
    return [{ key: `${block.id}:${allow.id}`, review: block.permissionRequest, decide: async (approved: boolean) => {
      const current = getSnapshot();
      if (!current || binding !== JSON.stringify([current.runtimeInstanceId, current.viewId, current.session?.id])) return;
      if (!current.feed.blocks.some((value) => value.type === "notice" && value.id === block.id && value.actions.some((action) => action.id === allow.id))) return;
      await dispatchAction(approved ? allow.id : deny.id);
    } }];
  }));
}
