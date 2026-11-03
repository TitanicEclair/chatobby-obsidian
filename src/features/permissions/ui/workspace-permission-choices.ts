import type { FrontendWorkspacePermissionPolicy } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection } from "../../../ui/shared/page-shell";

const MODES = [
  { id: "read-only", title: "Read-only", description: "Read and search files, browse the web, and use approved reading commands. Changes and execution require permission." },
  { id: "workspace", title: "Workspace", description: "Read, create and edit within this workspace. Only approved reading and file-management commands run; other execution requires permission." },
  { id: "full", title: "Full access", description: "Read, change and delete files, run commands, and use the network with your account's access." },
] as const;

/** Render the same three modes presented by the runtime-owned composer control. */
export function renderPermissionChoices(parent: HTMLElement, policy: FrontendWorkspacePermissionPolicy, busy: boolean, groupName: string, onChange: (patch: Partial<Pick<FrontendWorkspacePermissionPolicy, "accessMode" | "requestBehavior">>) => void): void {
  const section = createPageSection(parent, { title: "Access mode", description: "Chatobby checks each tool call and command. These permissions do not create an operating-system sandbox.", surface: "divided", className: "chatobby-permissions__section" });
  const group = section.content.createDiv({ cls: "chatobby-permissions__mode-list", attr: { role: "radiogroup", "aria-label": "Agent access mode" } });
  for (const option of MODES) {
    const label = group.createEl("label", { cls: `chatobby-permissions__mode${policy.accessMode === option.id ? " is-selected" : ""}` });
    const radio = label.createEl("input", { attr: { type: "radio", name: groupName, value: option.id, "aria-label": option.title, "data-page-focus-key": `permissions:mode:${option.id}` } });
    radio.checked = policy.accessMode === option.id;
    radio.disabled = busy;
    const copy = label.createDiv({ cls: "chatobby-permissions__mode-copy" });
    copy.createDiv({ cls: "chatobby-permissions__mode-title", text: option.title });
    copy.createDiv({ cls: "chatobby-permissions__mode-description", text: option.description });
    radio.addEventListener("change", () => { if (radio.checked && !radio.disabled) onChange({ accessMode: option.id }); });
  }
  const requests = createPageSection(parent, { title: "When an action needs permission", description: "Choose what happens when an agent attempts an action outside this workspace's mode.", surface: "divided", className: "chatobby-permissions__section" });
  const select = requests.content.createEl("select", { cls: "chatobby-permissions__workspace-select", attr: { "aria-label": "Permission requests", "data-page-focus-key": "permissions:request-behavior" } });
  select.createEl("option", { value: "ask", text: "Ask me — require a reason" });
  select.createEl("option", { value: "reject", text: "Reject automatically" });
  select.value = policy.requestBehavior;
  select.disabled = busy || policy.accessMode === "full";
  select.addEventListener("change", () => { if (!select.disabled && (select.value === "ask" || select.value === "reject")) onChange({ requestBehavior: select.value }); });
  requests.content.createDiv({ cls: "chatobby-permissions__scope-detail", text: policy.accessMode === "full" ? "Full access does not require mode-based permission requests. This choice is saved for restricted modes." : policy.requestBehavior === "ask" ? "The agent can request an exception with a reason. Review the exact action above the composer, then allow it once or deny it." : "Out-of-policy actions are rejected with a reason. The agent cannot raise an approval request for them." });
}
