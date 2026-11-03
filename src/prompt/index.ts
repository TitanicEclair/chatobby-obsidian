/** Connector prompt entry points. Admission stays in authorized-context.
 * @see docs/api/context.md
 */
export { gatherVaultContext } from "./capture";
export { gatherVaultCapabilities } from "./capabilities";
export { toPromptContextPacket, type PromptWorkspaceContext } from "./context-packet";
export { gatherEnvironmentContext } from "./environment";
