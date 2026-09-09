import type { FrontendPermissionScreenViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection } from "../shared/page-shell";

export type WorkspaceAccessChoice = NonNullable<FrontendPermissionScreenViewModel["workspaceVaultAccess"]>[number];

export function renderWorkspaceAccess(
  parent: HTMLElement,
  model: FrontendPermissionScreenViewModel,
  busy: boolean,
  supported: boolean,
  onChange: (choice: WorkspaceAccessChoice, enabled: boolean) => void,
  onManageTools?: () => void,
): void {
  const session = createPageSection(parent, {
    title: "Chat access",
    description: "Choose Read-only, Workspace or Full access in the chat composer. Subagents use their parent chat’s access choices.",
    surface: "divided", className: "chatobby-permissions__section",
  });
  session.content.createDiv({ cls: "chatobby-permissions__notice", text: "Workspace restrictions help limit accidental file changes. Full access runs with your user account's authority." });
  const grants = createPageSection(parent, {
    title: "Obsidian app access",
    description: "Allow Obsidian tools and context for these Projects and chats.",
    surface: "divided", className: "chatobby-permissions__section",
  });
  grants.content.createDiv({ cls: "chatobby-permissions__warning", text: "App access can read or change the whole Vault and use Obsidian’s network, outside workspace protection.", attr: { role: "note" } });
  if (!supported || !model.workspaceVaultAccess) {
    grants.content.createDiv({ text: "Reconnect to a runtime that supports workspace access choices." });
  } else for (const choice of model.workspaceVaultAccess) {
    const row = grants.content.createEl("label", { cls: "chatobby-permissions__network-control" });
    const copy = row.createDiv({ cls: "chatobby-permissions__network-copy" });
    copy.createDiv({ cls: "chatobby-permissions__network-title", text: choice.label });
    const toggle = row.createEl("input", { cls: "chatobby-permissions__network-toggle", attr: { type: "checkbox", role: "switch", "aria-label": `Obsidian access for ${choice.label}` } });
    toggle.checked = choice.enabled;
    toggle.disabled = busy || model.loading;
    toggle.addEventListener("change", () => onChange(choice, toggle.checked));
  }
  const tools = createPageSection(parent, {
    title: "Connected tools and servers",
    description: "Choose which MCP servers and tools Chatobby can use in Plugins.",
    surface: "divided", className: "chatobby-permissions__section",
  });
  if (onManageTools) tools.content.createEl("button", { text: "Manage connected tools" }).addEventListener("click", onManageTools);
}
