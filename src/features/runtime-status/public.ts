/** Runtime lifecycle banner controller for the main Chatobby view. */
export { RuntimeStatusController } from "./application/runtime-status-controller";

/** Host contract for lifecycle status rendering and recovery actions. */
export type { RuntimeStatusHost } from "./application/runtime-status-controller";

/** Runtime action menu attached to the compact connection indicator. */
export { RuntimeStatusMenu } from "./application/runtime-status-menu";

/** Host contract for runtime menu state and lifecycle actions. */
export type { RuntimeStatusMenuHost } from "./application/runtime-status-menu";

/** Compact composer-adjacent runtime update affordance. */
export { RuntimeUpdateController } from "./application/runtime-update-controller";
/** Host contract for the runtime update affordance. */
export type { RuntimeUpdateControllerHost } from "./application/runtime-update-controller";

/** Themed, user-controlled runtime installation and update wizard. */
export { RuntimeInstallModal } from "./ui/runtime-install-modal";
/** Host contract for the runtime installation wizard. */
export type { RuntimeInstallModalHost } from "./ui/runtime-install-modal";
