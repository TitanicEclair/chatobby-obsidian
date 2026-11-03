import type { App } from "obsidian";
import type { FrontendMcpServerViewModel } from "../../../../vendor/chatobby-client/frontend-contracts.js";
import type { FrontendPluginMcpScreenViewModel } from "../../../../vendor/chatobby-client/frontend-plugin-contracts";
import { createPageActionRow, createPageSection } from "../../../../ui/shared/page-shell";
import { action, inputField } from "../controls/form-fields";
import { secretReferenceField } from "../controls/secret-reference";
import { renderExternalLink } from "../links";

export type ServerOperation = "mcp.discover" | "mcp.connect" | "mcp.disconnect" | "mcp.auth-start" | "mcp.diagnostics";
export interface ServerControlOptions {
  readonly app: App;
  readonly busy: boolean;
  readonly removeConfirmId: string | null;
  readonly actions: {
    readonly onOperation: (operation: ServerOperation, serverId: string) => void;
    readonly onCancelOperation: (serverId: string) => void;
    readonly onReviewSuggestion: (server: FrontendMcpServerViewModel) => void;
    readonly onSetEnabled: (server: FrontendMcpServerViewModel, enabled: boolean) => void;
    readonly onRemoveConfirmation: (serverId: string | null) => void;
    readonly onRemove: (server: FrontendMcpServerViewModel) => void;
    readonly onSetToolEnabled: (server: FrontendMcpServerViewModel, toolName: string, enabled: boolean) => void;
    readonly onSetCredential: (server: FrontendMcpServerViewModel, reference: string) => void;
  };
}

/** Presentation returns only its derived token-link refresh, after PageShell restores values. */
export function renderServerControls(
  actionsParent: HTMLElement,
  sectionsParent: HTMLElement,
  server: FrontendMcpServerViewModel,
  options: ServerControlOptions,
): (() => void) | undefined {
  renderServerActions(actionsParent, server, options);
  const refresh = server.authentication === "bearer" ? renderCredentialSelector(sectionsParent, server, options) : undefined;
  renderToolExposure(sectionsParent, server, options);
  return refresh;
}

function renderServerActions(
  parent: HTMLElement,
  server: FrontendMcpServerViewModel,
  options: ServerControlOptions,
): void {
  const actions = createPageActionRow(parent, "chatobby-mcp__server-actions");
  if (server.state === "connecting" || server.state === "discovering") {
    actions.createSpan({
      cls: "chatobby-mcp__operation-status",
      text:
        server.state === "connecting" ? "Connecting…" : "Testing connection…",
      attr: { role: "status", "aria-live": "polite" },
    });
    action(
      actions,
      server.state === "connecting" ? "Cancel connection" : "Stop test",
      () => options.actions.onCancelOperation(server.id),
    );
    return;
  }
  if (
    server.sourceScope === "project" &&
    !server.writable &&
    !server.builtIn
  ) {
    const review = actions.createEl("button", {
      cls: "mod-cta",
      text: "Review & add",
      attr: { type: "button" },
    });
    review.disabled = options.busy;
    review.addEventListener("click", () => {
      options.actions.onReviewSuggestion(server);
    });
  }
  const toggle = actions.createEl("button", {
    text: server.enabled ? "Disable" : "Enable",
    attr: { type: "button" },
  });
  toggle.disabled = options.busy || server.builtIn || !server.writable;
  toggle.addEventListener("click", () => options.actions.onSetEnabled(server, !server.enabled));
  if (
    server.writable &&
    server.authentication === "oauth" &&
    (server.requiresAuthentication || server.state === "needs-sign-in")
  ) {
    action(actions, "Sign in", () =>
      options.actions.onOperation("mcp.auth-start", server.id),
    );
  }
  if (server.enabled && server.state !== "connected") {
    const connect = action(actions, "Connect", () =>
      options.actions.onOperation("mcp.connect", server.id),
    );
    if (
      server.transport === "local" &&
      server.localExecution?.status !== "available"
    ) {
      connect.disabled = true;
      connect.setAttr(
        "title",
        localExecutionReason(server),
      );
    } else if (
      server.authentication === "bearer" &&
      !server.credentialReference
    ) {
      connect.disabled = true;
      connect.setAttr(
        "title",
        "Link an access token in Authentication before connecting.",
      );
      connect.setAttr("aria-describedby", `mcp-auth-status-${server.id}`);
    }
  }
  if (server.state === "connected") {
    action(actions, "Disconnect", () =>
      options.actions.onOperation("mcp.disconnect", server.id),
    );
  }
  const discover = action(actions, "Test & discover", () =>
    options.actions.onOperation("mcp.discover", server.id),
  );
  discover.disabled =
    options.busy ||
    !server.writable ||
    (server.transport === "local" &&
      server.localExecution?.status !== "available");
  discover.setAttr(
    "title",
    requiresRegistrationReview(server)
      ? "Review and add this suggestion to your Chatobby settings before contacting it."
      : server.transport === "local"
      ? server.localExecution?.status === "available"
        ? "Starts this local executable temporarily and unsandboxed as your user account. It does not enable agent access."
        : localExecutionReason(server)
      : !server.writable
        ? "This built-in connection is managed by Chatobby."
      : "Contacts this server temporarily. It does not enable agent access.",
  );
  action(actions, "Diagnostics", () =>
    options.actions.onOperation("mcp.diagnostics", server.id),
  );
  if (server.writable && !server.builtIn) {
    const remove = actions.createEl("button", {
      cls: "is-danger",
      text: "Remove",
      attr: { type: "button" },
    });
    remove.addEventListener("click", () => options.actions.onRemoveConfirmation(server.id));
  }
  if (options.removeConfirmId !== server.id) return;
  const confirm = parent.createDiv({ cls: "chatobby-mcp__confirm" });
  confirm.createDiv({ text: `Remove ${server.id} from your Chatobby settings?` });
  const confirmActions = createPageActionRow(confirm);
  action(confirmActions, "Cancel", () => options.actions.onRemoveConfirmation(null));
  const remove = confirmActions.createEl("button", {
    cls: "mod-warning",
    text: "Remove plugin",
    attr: { type: "button" },
  });
  remove.addEventListener("click", () => options.actions.onRemove(server));
}

function renderToolExposure(
  parent: HTMLElement,
  server: FrontendMcpServerViewModel,
  options: ServerControlOptions,
): void {
  const section = createPageSection(parent, {
    title: "Agent tool access",
    description:
      "Choose the exact capabilities this registered server may expose to the agent. Selecting tools does not change the agent's access mode or grant project, vault, filesystem, shell, or network access.",
    surface: "divided",
  });
  section.content.createDiv({
    cls: "chatobby-mcp__tool-test-note",
    text:
      requiresRegistrationReview(server)
        ? "Review and add this suggestion before Chatobby contacts it. Nothing is exposed automatically."
        : server.transport === "remote"
        ? "Test & discover contacts this server and can affect the remote service. It never turns on agent access."
        : server.localExecution?.status === "available"
          ? "Test & discover starts this local executable temporarily and unsandboxed as your user account. It never turns on agent access."
          : `${localExecutionReason(server)} Nothing is exposed automatically.`,
  });
  const summary = section.content.createDiv({
    cls: "chatobby-mcp__tool-access-summary",
    text: `${server.enabledToolCount} exposed · ${server.toolCount} ${server.toolCount === 1 ? "tool" : "tools"} · ${server.resourceCount} ${server.resourceCount === 1 ? "resource" : "resources"}`,
  });
  summary.setAttr("aria-live", "polite");

  if (server.toolReviewRequired) {
    section.content.createDiv({
      cls: "chatobby-mcp__tool-review",
      text: "Review required. This older connection used implicit access, so no tools are exposed until you choose them.",
      attr: { role: "status" },
    });
  }

  const capabilities = [
    ...server.tools.map((tool) => ({
      kind: "Tool",
      name: tool.name,
      title: tool.title ?? tool.name,
      description: tool.description,
      enabled: tool.enabled,
    })),
    ...server.resources.map((resource) => ({
      kind: "Resource",
      name: resource.toolName,
      title: resource.name,
      description: resource.description ?? resource.uri,
      enabled: resource.enabled,
    })),
  ];
  if (capabilities.length === 0) {
    section.content.createDiv({
      cls: "chatobby-mcp__tool-empty",
      text:
        requiresRegistrationReview(server)
          ? "Review and add this suggestion to your Chatobby settings before testing it. Nothing is exposed automatically."
          : server.transport === "remote"
          ? "Use Test & discover to contact this server and review its reported capabilities. Nothing is exposed automatically."
          : server.localExecution?.status === "available"
            ? "Use Test & discover to start this local executable temporarily and review its reported capabilities. It runs unsandboxed, and nothing is exposed automatically."
            : `${localExecutionReason(server)} Nothing is exposed automatically.`,
    });
    return;
  }

  const list = section.content.createDiv({
    cls: "chatobby-mcp__tool-access-list",
  });
  for (const capability of capabilities) {
    const row = list.createEl("label", {
      cls: "chatobby-mcp__tool-access-row",
    });
    const checkbox = row.createEl("input", {
      attr: {
        type: "checkbox",
        "aria-label": `Expose ${capability.kind.toLocaleLowerCase()} ${capability.title} to agents`,
      },
    });
    checkbox.checked = capability.enabled;
    checkbox.disabled = options.busy || server.builtIn || !server.writable;
    const copy = row.createDiv({ cls: "chatobby-mcp__tool-access-copy" });
    const heading = copy.createDiv({
      cls: "chatobby-mcp__tool-access-heading",
    });
    heading.createSpan({
      cls: "chatobby-mcp__tool-access-title",
      text: capability.title,
    });
    heading.createSpan({
      cls: "chatobby-mcp__tool-access-kind",
      text: capability.kind,
    });
    if (capability.description) {
      copy.createDiv({
        cls: "chatobby-mcp__tool-access-description",
        text: capability.description,
      });
    }
    checkbox.addEventListener("change", () => options.actions.onSetToolEnabled(server, capability.name, checkbox.checked));
  }
}

function renderCredentialSelector(
  parent: HTMLElement,
  server: FrontendMcpServerViewModel,
  options: ServerControlOptions,
): () => void {
  const section = createPageSection(parent, {
    title: "Authentication",
    description:
      "Choose which token this plugin should use. The token stays in Obsidian; Chatobby saves only the secret name that points to it.",
    surface: "divided",
  });
  const status = section.content.createDiv({
    cls: "chatobby-mcp__credential-status",
    attr: { id: `mcp-auth-status-${server.id}` },
  });
  if (server.credentialReference) {
    status.createSpan({
      text: `Linked to “${server.credentialReference}”. Select another saved secret below to change it.`,
    });
  } else {
    status.createSpan({
      text: "No access token is linked. If you create a new secret in Obsidian, select it below before choosing Connect.",
    });
  }
  const credential = secretReferenceField(
    options.app,
    section.content,
    "Saved access token",
    `mcp:${server.id}:credential`,
    server.credentialReference ?? "",
  );
  const actions = createPageActionRow(section.content);
  const link = actions.createEl("button", {
    cls: "mod-cta",
    text: server.credentialReference
      ? "Change linked token"
      : "Link selected token",
    attr: { type: "button" },
  });
  const updateLinkState = (): void => {
    link.disabled =
      !credential.select.value ||
      credential.select.value === server.credentialReference;
  };
  credential.select.addEventListener("change", updateLinkState);
  credential.onSecretsChanged(updateLinkState);
  updateLinkState();
  link.addEventListener("click", () => {
    const reference = credential.select.value;
    if (!reference || reference === server.credentialReference) return;
    options.actions.onSetCredential(server, reference);
  });
  return updateLinkState;
}

export function renderPendingAuthentication(
  parent: HTMLElement,
  pending: NonNullable<FrontendPluginMcpScreenViewModel["pendingAuthentication"]>,
  onComplete: (serverId: string, input: string) => void,
): void {
  const section = createPageSection(parent, {
    title: `Sign in to ${pending.serverId}`,
    description:
      "Open the sign-in page, then paste the returned code or redirect URL.",
    surface: "inset",
  });
  renderExternalLink(section.content, "Open sign-in page", pending.authorizationUrl);
  const input = inputField(
    section.content,
    "Code or redirect URL",
    `mcp:auth:${pending.serverId}`,
    "",
  );
  const actions = createPageActionRow(section.content);
  const complete = actions.createEl("button", {
    cls: "mod-cta",
    text: "Complete sign-in",
    attr: { type: "button" },
  });
  complete.addEventListener("click", () => onComplete(pending.serverId, input.value.trim()));
}

function localExecutionReason(server: FrontendMcpServerViewModel): string {
  if (
    server.transport === "local" &&
    server.localExecution?.status === "unavailable"
  ) {
    return server.localExecution.reason;
  }
  return "Local executable connections are unavailable until the runtime reports an admitted execution mode.";
}

function requiresRegistrationReview(
  server: FrontendMcpServerViewModel,
): boolean {
  return server.sourceScope === "project" && !server.writable && !server.builtIn;
}
