import { setIcon } from "obsidian";
import type {
  FrontendMcpCatalogItemViewModel,
  FrontendMcpScreenViewModel,
  FrontendMcpServerDraft,
  FrontendMcpServerViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageActionRow,
  createPageIconButton,
  createPageSection,
  createPageState,
  createPageToolbar,
  PageShell,
} from "../../../ui/shared/page-shell";

export type McpViewIntent =
  | { readonly type: "mcp.set-view"; readonly payload: {
      readonly tab: "installed" | "discover";
      readonly query: string;
      readonly cursor?: string;
    } }
  | { readonly type: "mcp.preview"; readonly payload: { readonly draft: FrontendMcpServerDraft } }
  | { readonly type: "mcp.save"; readonly payload: {
      readonly expectedConfigRevision: string;
      readonly draft: FrontendMcpServerDraft;
    } }
  | { readonly type: "mcp.configure-registry"; readonly payload: {
      readonly expectedConfigRevision: string;
      readonly registryName: string;
      readonly registryVersion: string;
      readonly scope: "user" | "project";
    } }
  | { readonly type: "mcp.set-enabled"; readonly payload: {
      readonly expectedConfigRevision: string;
      readonly serverId: string;
      readonly enabled: boolean;
      readonly scope?: "user" | "project";
    } }
  | { readonly type:
      | "mcp.discover"
      | "mcp.connect"
      | "mcp.disconnect"
      | "mcp.auth-start"
      | "mcp.check-update"
      | "mcp.diagnostics";
      readonly payload: { readonly serverId: string };
    }
  | { readonly type: "mcp.auth-complete"; readonly payload: {
      readonly serverId: string;
      readonly input: string;
    } }
  | { readonly type: "mcp.apply-update" | "mcp.remove"; readonly payload: {
      readonly expectedConfigRevision: string;
      readonly serverId: string;
      readonly scope?: "user" | "project";
    } };

interface McpViewProps {
  getModel(): FrontendMcpScreenViewModel | null;
  subscribe(listener: (model: FrontendMcpScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onIntent(intent: McpViewIntent): Promise<void>;
}

export class McpView extends ChatobbyComponent {
  private readonly props: McpViewProps;
  private unsubscribe: (() => void) | null = null;
  private shell: PageShell | null = null;
  private refreshButton: HTMLButtonElement | null = null;
  private expandedId: string | null = null;
  private creating = false;
  private removeConfirmId: string | null = null;
  private localError: string | null = null;
  private busy = false;

  constructor(props: McpViewProps) {
    super();
    this.props = props;
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-mcp";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    this.shell = new PageShell(container, { title: "MCP servers", width: "wide" });
    const add = createPageIconButton(this.shell.actions, "plus", "Add MCP server");
    add.addEventListener("click", () => {
      this.creating = true;
      this.expandedId = null;
      this.renderState(this.props.getModel());
    });
    this.refreshButton = createPageIconButton(this.shell.actions, "refresh-cw", "Refresh MCP servers");
    this.refreshButton.addEventListener("click", () => void this.refresh());
    createPageIconButton(this.shell.actions, "x", "Close MCP servers")
      .addEventListener("click", () => this.props.onBack());
    this.unsubscribe = this.props.subscribe((model) => this.renderState(model));
    this.renderState(this.props.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  setLocalError(error: string | null): void {
    this.localError = error;
    this.renderState(this.props.getModel());
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape" && event.key !== "BrowserBack") return false;
    if (this.removeConfirmId) this.removeConfirmId = null;
    else if (this.creating) this.creating = false;
    else if (this.expandedId) this.expandedId = null;
    else return false;
    event.preventDefault();
    this.renderState(this.props.getModel());
    return true;
  }

  private renderState(model: FrontendMcpScreenViewModel | null): void {
    const shell = this.shell;
    if (!shell) return;
    const error = this.localError ?? model?.error;
    shell.setBusy(this.busy);
    this.refreshButton?.toggleClass("is-loading", model?.loading ?? false);
    this.refreshButton?.setAttr("aria-busy", String(model?.loading ?? false));
    shell.setStatus(
      error
        ? { tone: "error", message: error, actionLabel: "Try again", onAction: () => void this.refresh() }
        : model?.statusMessage
          ? { tone: "success", message: model.statusMessage }
          : null,
    );
    shell.setTabs([
      {
        id: "installed",
        label: "Installed",
        count: model?.servers.length,
        active: model?.selectedTab !== "discover",
        onSelect: () => void this.changeView("installed", ""),
      },
      {
        id: "discover",
        label: "Discover",
        active: model?.selectedTab === "discover",
        onSelect: () => void this.changeView("discover", model?.query ?? ""),
      },
    ]);
    shell.updateBody(model?.selectedTab ?? "installed", (body) => {
      if (!model) {
        createPageState(body, {
          kind: error ? "error" : "loading",
          title: error ? "MCP servers are unavailable" : "Loading MCP servers",
          description: error ? "Check the Chatobby runtime and try again." : "Reading installed server configuration.",
        });
        return;
      }
      if (model.pendingAuthentication) this.renderAuthentication(body, model);
      if (model.selectedTab === "discover") this.renderDiscover(body, model);
      else this.renderInstalled(body, model);
    });
  }

  private renderInstalled(parent: HTMLElement, model: FrontendMcpScreenViewModel): void {
    if (this.creating) this.renderEditor(parent, model);
    const section = createPageSection(parent, {
      title: "Installed servers",
      description: "Enable only servers you trust. Disabled servers do not expose tools or start processes.",
      surface: "divided",
    });
    const list = section.content.createDiv({ cls: "chatobby-mcp__list" });
    if (model.servers.length === 0 && !this.creating) {
      createPageState(list, {
        kind: "empty",
        title: "No MCP servers installed",
        description: "Add your own server or find one in the official registry.",
      });
      return;
    }
    for (const server of model.servers) this.renderServer(list, model, server);
  }

  private renderServer(
    parent: HTMLElement,
    model: FrontendMcpScreenViewModel,
    server: FrontendMcpServerViewModel,
  ): void {
    const expanded = this.expandedId === server.id;
    const row = parent.createDiv({ cls: `chatobby-mcp__server${expanded ? " is-expanded" : ""}` });
    const summary = row.createDiv({ cls: "chatobby-mcp__server-summary" });
    const open = summary.createEl("button", {
      cls: "chatobby-mcp__server-open",
      attr: { type: "button", "aria-expanded": String(expanded) },
    });
    const indicator = open.createSpan({ cls: "chatobby-mcp__indicator", attr: { "aria-hidden": "true" } });
    if (server.state === "discovering" || server.state === "updating") {
      setIcon(indicator, "loader-circle");
      indicator.addClass("is-loading");
    }
    const copy = open.createSpan({ cls: "chatobby-mcp__server-copy" });
    copy.createSpan({ cls: "chatobby-mcp__server-name", text: server.id });
    copy.createSpan({
      cls: "chatobby-mcp__server-meta",
      text: `${stateLabel(server.state)} · ${server.transport === "remote" ? "Remote" : "Local"} · ${server.sourceLabel}`,
    });
    const counts = open.createSpan({
      cls: "chatobby-mcp__counts",
      text: `${server.toolCount} ${server.toolCount === 1 ? "tool" : "tools"}`,
    });
    counts.setAttr("title", `${server.toolCount} tools and ${server.resourceCount} resources`);
    open.addEventListener("click", () => {
      this.expandedId = expanded ? null : server.id;
      this.removeConfirmId = null;
      this.creating = false;
      this.renderState(this.props.getModel());
    });
    const toggle = summary.createEl("button", {
      cls: `chatobby-mcp__toggle${server.enabled ? " is-enabled" : ""}`,
      text: server.enabled ? "On" : "Off",
      attr: { type: "button", "aria-pressed": String(server.enabled) },
    });
    toggle.disabled = this.busy || server.builtIn || !server.writable;
    toggle.title = server.builtIn
      ? "This built-in server is managed by Chatobby"
      : server.writable
        ? "Enable or disable this server"
        : "This inherited server cannot be changed here";
    toggle.addEventListener("click", () => void this.runIntent({
      type: "mcp.set-enabled",
      payload: {
        expectedConfigRevision: model.configRevision,
        serverId: server.id,
        enabled: !server.enabled,
        scope: server.writable ? writableScope(server.sourceScope) : undefined,
      },
    }));
    if (expanded) this.renderServerDetails(row, model, server);
  }

  private renderServerDetails(
    parent: HTMLElement,
    model: FrontendMcpScreenViewModel,
    server: FrontendMcpServerViewModel,
  ): void {
    const details = parent.createDiv({ cls: "chatobby-mcp__details" });
    const definition = details.createEl("dl", { cls: "chatobby-mcp__definition" });
    detail(definition, "Connection", server.url ?? [server.command, ...server.arguments].filter(Boolean).join(" "));
    detail(definition, "Starts", lifecycleLabel(server.lifecycle));
    if (server.workingDirectory) detail(definition, "Working folder", server.workingDirectory);
    if (server.environmentNames.length > 0) detail(definition, "Environment", server.environmentNames.join(", "));
    if (server.headerNames.length > 0) detail(definition, "Headers", server.headerNames.join(", "));
    if (server.registry) detail(definition, "Registry version", server.registry.version);
    const actions = createPageActionRow(details, "chatobby-mcp__actions");
    if (server.requiresAuthentication || server.state === "needs-sign-in") {
      action(actions, "Sign in", () => this.simpleIntent("mcp.auth-start", server.id));
    }
    if (server.enabled && server.state !== "connected") {
      action(actions, "Connect", () => this.simpleIntent("mcp.connect", server.id));
    }
    if (server.state === "connected") {
      action(actions, "Disconnect", () => this.simpleIntent("mcp.disconnect", server.id));
    }
    if (server.enabled) action(actions, "Refresh tools", () => this.simpleIntent("mcp.discover", server.id));
    action(actions, "Diagnostics", () => this.simpleIntent("mcp.diagnostics", server.id));
    if (server.registry && server.writable) {
      action(actions, "Check for update", () => this.simpleIntent("mcp.check-update", server.id));
      action(actions, "Update", () => this.runIntent({
        type: "mcp.apply-update",
        payload: {
          serverId: server.id,
          expectedConfigRevision: model.configRevision,
          scope: writableScope(server.sourceScope),
        },
      }));
    }
    if (server.writable && !server.builtIn) {
      const remove = actions.createEl("button", {
        cls: "is-danger",
        text: "Remove",
        attr: { type: "button" },
      });
      remove.addEventListener("click", () => {
        this.removeConfirmId = server.id;
        this.renderState(this.props.getModel());
      });
    }
    if (this.removeConfirmId === server.id) {
      const confirm = details.createDiv({ cls: "chatobby-mcp__confirm" });
      confirm.createDiv({ text: `Remove ${server.id} from ${server.sourceScope === "project" ? "this project" : "your Chatobby settings"}?` });
      const confirmActions = createPageActionRow(confirm);
      action(confirmActions, "Cancel", () => {
        this.removeConfirmId = null;
        this.renderState(this.props.getModel());
      });
      const remove = confirmActions.createEl("button", {
        cls: "mod-warning",
        text: "Remove server",
        attr: { type: "button" },
      });
      remove.addEventListener("click", () => void this.runIntent({
        type: "mcp.remove",
        payload: {
          serverId: server.id,
          expectedConfigRevision: model.configRevision,
          scope: writableScope(server.sourceScope),
        },
      }, () => {
        this.removeConfirmId = null;
        this.expandedId = null;
      }));
    }
  }

  private renderEditor(parent: HTMLElement, model: FrontendMcpScreenViewModel): void {
    const section = createPageSection(parent, {
      title: "Add MCP server",
      description: "Use a remote endpoint or a local command. Secret values stay in environment variables.",
      surface: "inset",
    });
    const form = section.content.createDiv({ cls: "chatobby-mcp__editor" });
    const name = inputField(form, "Name", "mcp:new:name", "my-server");
    const scope = selectField(form, "Available in", "mcp:new:scope", [
      ["project", "This project"],
      ["user", "All projects"],
    ]);
    const transport = selectField(form, "Connection", "mcp:new:transport", [
      ["remote", "Remote URL"],
      ["local", "Local command"],
    ]);
    const lifecycle = selectField(form, "Start server", "mcp:new:lifecycle", [
      ["lazy", "When a tool is used"],
      ["keep-alive", "Keep it running"],
      ["eager", "When Chatobby starts"],
    ]);
    const url = inputField(form, "Server URL", "mcp:new:url", "https://example.com/mcp");
    const authentication = selectField(form, "Sign-in method", "mcp:new:auth", [
      ["oauth", "Browser sign-in"],
      ["bearer", "Token from an environment variable"],
      ["none", "No sign-in"],
    ]);
    const bearer = inputField(form, "Token environment variable", "mcp:new:bearer", "MY_MCP_TOKEN");
    const command = inputField(form, "Command", "mcp:new:command", "npx");
    const argumentsInput = textAreaField(form, "Arguments, one per line", "mcp:new:arguments");
    const workingDirectory = inputField(form, "Working folder (optional)", "mcp:new:cwd", "");
    const environment = textAreaField(form, "Environment mappings, NAME=ENV_VARIABLE", "mcp:new:environment");
    const headers = textAreaField(form, "Header mappings, HEADER=ENV_VARIABLE", "mcp:new:headers");
    const refreshTransport = (): void => {
      const remote = transport.value === "remote";
      url.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", !remote);
      authentication.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", !remote);
      bearer.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass(
        "is-hidden",
        !remote || authentication.value !== "bearer",
      );
      headers.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", !remote);
      command.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", remote);
      argumentsInput.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", remote);
      workingDirectory.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", remote);
      environment.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", remote);
    };
    transport.addEventListener("change", refreshTransport);
    authentication.addEventListener("change", refreshTransport);
    refreshTransport();
    const actions = createPageActionRow(form);
    action(actions, "Cancel", () => {
      this.creating = false;
      this.renderState(this.props.getModel());
    });
    const preview = actions.createEl("button", { text: "Check", attr: { type: "button" } });
    preview.addEventListener("click", () => void this.runIntent({
      type: "mcp.preview",
      payload: { draft: collectDraft() },
    }));
    const save = actions.createEl("button", { cls: "mod-cta", text: "Add disabled", attr: { type: "button" } });
    save.addEventListener("click", () => void this.runIntent({
      type: "mcp.save",
      payload: {
        expectedConfigRevision: model.configRevision,
        draft: collectDraft(),
      },
    }, () => {
      this.creating = false;
    }));

    const collectDraft = (): FrontendMcpServerDraft => ({
      name: name.value.trim(),
      scope: scope.value === "user" ? "user" : "project",
      enabled: false,
      lifecycle: isLifecycle(lifecycle.value) ? lifecycle.value : "lazy",
      transport: transport.value === "local" ? "local" : "remote",
      command: command.value.trim() || undefined,
      arguments: lines(argumentsInput.value),
      workingDirectory: workingDirectory.value.trim() || undefined,
      url: url.value.trim() || undefined,
      authentication: isAuthentication(authentication.value) ? authentication.value : "oauth",
      bearerTokenEnvironmentVariable: bearer.value.trim() || undefined,
      environment: mappings(environment.value),
      headers: mappings(headers.value),
    });
  }

  private renderDiscover(parent: HTMLElement, model: FrontendMcpScreenViewModel): void {
    const toolbar = createPageToolbar(parent, "chatobby-mcp__search");
    const search = toolbar.createEl("input", {
      attr: {
        type: "search",
        placeholder: "Search the official MCP registry",
        "aria-label": "Search the official MCP registry",
        "data-page-state-key": "mcp:catalog-query",
      },
    });
    search.value = model.query;
    const submit = toolbar.createEl("button", { text: "Search", attr: { type: "button" } });
    const runSearch = (): void => void this.changeView("discover", search.value.trim());
    submit.addEventListener("click", runSearch);
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      runSearch();
    });
    const section = createPageSection(parent, {
      title: model.query ? `Results for “${model.query}”` : "Official MCP registry",
      description: "Registry entries are added disabled so you can review them before any process starts.",
      surface: "divided",
    });
    const list = section.content.createDiv({ cls: "chatobby-mcp__catalog" });
    if (model.catalog.length === 0) {
      createPageState(list, {
        kind: model.query ? "no-results" : "empty",
        title: model.query ? "No matching servers" : "Search for an MCP server",
        description: model.query
          ? "Try a shorter name or a different capability."
          : "Find maintained server packages and remote endpoints in the official registry.",
      });
    } else {
      for (const item of model.catalog) this.renderCatalogItem(list, model, item);
    }
    if (model.nextCatalogCursor) {
      const more = parent.createEl("button", {
        cls: "chatobby-mcp__load-more",
        text: "Load more",
        attr: { type: "button" },
      });
      more.addEventListener("click", () => void this.changeView("discover", model.query, model.nextCatalogCursor));
    }
  }

  private renderCatalogItem(
    parent: HTMLElement,
    model: FrontendMcpScreenViewModel,
    item: FrontendMcpCatalogItemViewModel,
  ): void {
    const row = parent.createDiv({ cls: "chatobby-mcp__catalog-item" });
    const copy = row.createDiv({ cls: "chatobby-mcp__catalog-copy" });
    copy.createDiv({ cls: "chatobby-mcp__catalog-title", text: item.title });
    copy.createDiv({
      cls: "chatobby-mcp__catalog-description",
      text: item.description || "No description supplied by the publisher.",
    });
    copy.createDiv({
      cls: "chatobby-mcp__catalog-meta",
      text: `${item.transportLabel} · ${item.version}${item.environmentNames.length > 0 ? ` · Needs ${item.environmentNames.join(", ")}` : ""}`,
    });
    const actions = row.createDiv({ cls: "chatobby-mcp__catalog-actions" });
    if (item.repositoryUrl) {
      actions.createEl("a", {
        text: "Source",
        href: item.repositoryUrl,
        attr: { target: "_blank", rel: "noopener noreferrer" },
      });
    }
    const add = actions.createEl("button", {
      text: "Add",
      attr: { type: "button", title: item.unavailableReason ?? "Add disabled" },
    });
    add.disabled = !item.canConfigure || this.busy;
    add.addEventListener("click", () => void this.runIntent({
      type: "mcp.configure-registry",
      payload: {
        expectedConfigRevision: model.configRevision,
        registryName: item.name,
        registryVersion: item.version,
        scope: "project",
      },
    }));
  }

  private renderAuthentication(parent: HTMLElement, model: FrontendMcpScreenViewModel): void {
    const pending = model.pendingAuthentication;
    if (!pending) return;
    const section = createPageSection(parent, {
      title: `Sign in to ${pending.serverId}`,
      description: "Open the sign-in page, then paste the returned code or redirect URL.",
      surface: "inset",
    });
    section.content.createEl("a", {
      text: "Open sign-in page",
      href: pending.authorizationUrl,
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
    const input = inputField(section.content, "Code or redirect URL", `mcp:auth:${pending.serverId}`, "");
    const actions = createPageActionRow(section.content);
    const complete = actions.createEl("button", { cls: "mod-cta", text: "Complete sign-in", attr: { type: "button" } });
    complete.addEventListener("click", () => void this.runIntent({
      type: "mcp.auth-complete",
      payload: { serverId: pending.serverId, input: input.value.trim() },
    }));
  }

  private simpleIntent(
    type:
      | "mcp.discover"
      | "mcp.connect"
      | "mcp.disconnect"
      | "mcp.auth-start"
      | "mcp.check-update"
      | "mcp.diagnostics",
    serverId: string,
  ): void {
    void this.runIntent({ type, payload: { serverId } });
  }

  private async changeView(
    tab: "installed" | "discover",
    query: string,
    cursor?: string,
  ): Promise<void> {
    await this.runIntent({ type: "mcp.set-view", payload: { tab, query, cursor } });
  }

  private async refresh(): Promise<void> {
    this.localError = null;
    try {
      await this.props.onRefresh();
    } catch (error) {
      this.setLocalError(errorMessage(error));
    }
  }

  private async runIntent(intent: McpViewIntent, onSuccess?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onIntent(intent);
      onSuccess?.();
    } catch (error) {
      this.localError = errorMessage(error);
    } finally {
      this.busy = false;
      this.renderState(this.props.getModel());
    }
  }
}

function inputField(
  parent: HTMLElement,
  label: string,
  key: string,
  placeholder: string,
): HTMLInputElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  return wrapper.createEl("input", { attr: { placeholder, "data-page-state-key": key } });
}

function textAreaField(parent: HTMLElement, label: string, key: string): HTMLTextAreaElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  return wrapper.createEl("textarea", { attr: { rows: "3", "data-page-state-key": key } });
}

function selectField(
  parent: HTMLElement,
  label: string,
  key: string,
  options: readonly (readonly [string, string])[],
): HTMLSelectElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const select = wrapper.createEl("select", { attr: { "data-page-state-key": key } });
  for (const [value, text] of options) select.createEl("option", { value, text });
  return select;
}

function action(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const button = parent.createEl("button", { text: label, attr: { type: "button" } });
  button.addEventListener("click", onClick);
  return button;
}

function detail(parent: HTMLElement, label: string, value: string): void {
  parent.createEl("dt", { text: label });
  parent.createEl("dd", { text: value || "Not set" });
}

function lines(value: string): readonly string[] {
  return value.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
}

function mappings(value: string): FrontendMcpServerDraft["environment"] {
  return lines(value).map((entry) => {
    const separator = entry.indexOf("=");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error(`Use NAME=ENV_VARIABLE for “${entry}”.`);
    }
    return {
      name: entry.slice(0, separator).trim(),
      sourceEnvironmentVariable: entry.slice(separator + 1).trim(),
    };
  });
}

function isLifecycle(value: string): value is FrontendMcpServerDraft["lifecycle"] {
  return value === "lazy" || value === "eager" || value === "keep-alive";
}

function isAuthentication(value: string): value is NonNullable<FrontendMcpServerDraft["authentication"]> {
  return value === "oauth" || value === "bearer" || value === "none";
}

function stateLabel(state: FrontendMcpServerViewModel["state"]): string {
  if (state === "needs-sign-in") return "Sign-in needed";
  if (state === "discovering") return "Refreshing tools";
  if (state === "updating") return "Updating";
  if (state === "connected") return "Connected";
  if (state === "unavailable") return "Unavailable";
  if (state === "incompatible") return "Incompatible";
  if (state === "ready") return "Ready";
  if (state === "disabled") return "Off";
  return "Configured";
}

function lifecycleLabel(lifecycle: FrontendMcpServerViewModel["lifecycle"]): string {
  if (lifecycle === "keep-alive") return "Keep running";
  if (lifecycle === "eager") return "When Chatobby starts";
  return "When a tool is used";
}

function writableScope(scope: FrontendMcpServerViewModel["sourceScope"]): "user" | "project" {
  return scope === "project" ? "project" : "user";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
