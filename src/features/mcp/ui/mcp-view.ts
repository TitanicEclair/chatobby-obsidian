import { SecretComponent, setIcon, type App } from "obsidian";
import type {
  FrontendMcpServerDraft,
  FrontendMcpServerViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type {
  FrontendChatobbyPluginCapability,
  FrontendChatobbyPluginDetail,
  FrontendChatobbyPluginSummary,
  FrontendPluginMcpScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-plugin-contracts";
import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageActionRow,
  createPageIconButton,
  createPageSection,
  createPageState,
  createPageToolbar,
  PageShell,
} from "../../../ui/shared/page-shell";
import { renderPluginBrandIcon } from "./plugin-brand-icon";

export type McpViewIntent =
  | {
      readonly type: "mcp.set-view";
      readonly payload: {
        readonly tab: "installed" | "discover";
        readonly query: string;
        readonly cursor?: string;
      };
    }
  | {
      readonly type: "mcp.preview";
      readonly payload: { readonly draft: FrontendMcpServerDraft };
    }
  | {
      readonly type: "mcp.save";
      readonly payload: {
        readonly expectedConfigRevision: string;
        readonly draft: FrontendMcpServerDraft;
      };
    }
  | {
      readonly type: "mcp.configure-verified";
      readonly payload: {
        readonly expectedConfigRevision: string;
        readonly pluginId: string;
        readonly scope: "user" | "project";
      };
    }
  | {
      readonly type: "mcp.set-enabled";
      readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly enabled: boolean;
        readonly scope?: "user" | "project";
      };
    }
  | {
      readonly type: "mcp.set-credential-reference";
      readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly reference: string;
        readonly scope?: "user" | "project";
      };
    }
  | {
      readonly type: "mcp.set-tool-enabled";
      readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly toolName: string;
        readonly enabled: boolean;
        readonly scope?: "user" | "project";
      };
    }
  | {
      readonly type:
        | "mcp.discover"
        | "mcp.connect"
        | "mcp.disconnect"
        | "mcp.auth-start"
        | "mcp.diagnostics";
      readonly payload: { readonly serverId: string };
    }
  | {
      readonly type: "mcp.auth-complete";
      readonly payload: {
        readonly serverId: string;
        readonly input: string;
      };
    }
  | {
      readonly type: "mcp.remove";
      readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly scope?: "user" | "project";
      };
    };

interface McpViewProps {
  app: App;
  getModel(): FrontendPluginMcpScreenViewModel | null;
  subscribe(
    listener: (model: FrontendPluginMcpScreenViewModel | null) => void,
  ): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onNavigatePlugin(pluginId?: string): void;
  onIntent(intent: McpViewIntent): Promise<void>;
  initialPluginId?: string;
}

type PluginConnectionFilter = "all" | "remote" | "local";
type PluginSort = "relevance" | "name";

const SEARCH_DEBOUNCE_MS = 300;

export class McpView extends ChatobbyComponent {
  private readonly props: McpViewProps;
  private unsubscribe: (() => void) | null = null;
  private shell: PageShell | null = null;
  private backButton: HTMLButtonElement | null = null;
  private addButton: HTMLButtonElement | null = null;
  private refreshButton: HTMLButtonElement | null = null;
  private pluginId: string | undefined;
  private creating = false;
  private editorSeed: FrontendMcpServerViewModel | null = null;
  private removeConfirmId: string | null = null;
  private localError: string | null = null;
  private busy = false;
  private installedQuery = "";
  private connectionFilter: PluginConnectionFilter = "all";
  private sort: PluginSort = "relevance";
  private searchTimer: number | null = null;
  private readonly listScroll = new Map<"installed" | "discover", number>();
  private restoreListScroll = false;
  private readonly cancelledServerIds = new Set<string>();

  constructor(props: McpViewProps) {
    super();
    this.props = props;
    this.pluginId = props.initialPluginId;
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-mcp";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    this.shell = new PageShell(container, { title: "Plugins", width: "wide" });
    this.backButton = createPageIconButton(
      this.shell.actions,
      "arrow-left",
      "Back to plugins",
    );
    this.backButton.addClass("is-hidden");
    this.backButton.addEventListener("click", () =>
      this.props.onNavigatePlugin(),
    );
    this.addButton = this.shell.actions.createEl("button", {
      cls: "chatobby-mcp__connect",
      attr: { type: "button", "aria-label": "Add MCP connection" },
    });
    setIcon(this.addButton.createSpan({ attr: { "aria-hidden": "true" } }), "plug-zap");
    this.addButton.createSpan({ text: "Connect MCP" });
    this.addButton.addEventListener("click", () => {
      this.editorSeed = null;
      this.creating = true;
      this.renderState(this.props.getModel());
    });
    this.refreshButton = createPageIconButton(
      this.shell.actions,
      "refresh-cw",
      "Refresh plugins",
    );
    this.refreshButton.addEventListener("click", () => void this.refresh());
    createPageIconButton(
      this.shell.actions,
      "x",
      "Close plugins",
    ).addEventListener("click", () => this.props.onBack());
    this.unsubscribe = this.props.subscribe((model) => this.renderState(model));
    this.renderState(this.props.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = null;
    super.destroy();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  pluginRoute(): string | undefined {
    return this.pluginId;
  }

  setPluginRoute(pluginId?: string): void {
    if (pluginId === this.pluginId) return;
    const model = this.props.getModel();
    const shell = this.shell;
    if (!this.pluginId && shell && model) {
      this.listScroll.set(model.selectedTab, shell.body.scrollTop);
    }
    this.restoreListScroll = Boolean(this.pluginId && !pluginId);
    this.pluginId = pluginId;
    this.creating = false;
    this.editorSeed = null;
    this.removeConfirmId = null;
    this.renderState(model);
  }

  setLocalError(error: string | null): void {
    this.localError = error;
    this.renderState(this.props.getModel());
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape" && event.key !== "BrowserBack") return false;
    if (this.removeConfirmId) {
      this.removeConfirmId = null;
      this.renderState(this.props.getModel());
    } else if (this.creating) {
      this.creating = false;
      this.editorSeed = null;
      this.renderState(this.props.getModel());
    } else if (this.pluginId) {
      this.props.onNavigatePlugin();
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  }

  private renderState(model: FrontendPluginMcpScreenViewModel | null): void {
    const shell = this.shell;
    if (!shell) return;
    const error = this.localError ?? model?.error;
    const detail = this.pluginId ? model?.selectedPlugin : undefined;
    const awaitingDetail = Boolean(
      this.pluginId && model?.selectedPluginId !== this.pluginId,
    );
    shell.setBusy(this.busy || awaitingDetail);
    this.refreshButton?.toggleClass("is-loading", model?.loading ?? false);
    this.refreshButton?.setAttr("aria-busy", String(model?.loading ?? false));
    this.backButton?.toggleClass("is-hidden", !this.pluginId);
    this.addButton?.toggleClass("is-hidden", Boolean(this.pluginId));
    shell.setTitle(
      detail?.title ?? (this.pluginId ? "Plugin" : "Plugins"),
      detail ? pluginSubtitle(detail) : undefined,
    );
    shell.setStatus(
      error
        ? {
            tone: "error",
            message: error,
            actionLabel: "Try again",
            onAction: () => void this.refresh(),
          }
        : model?.statusMessage
          ? { tone: "success", message: model.statusMessage }
          : null,
    );

    if (this.pluginId) {
      shell.setTabs([]);
      shell.updateBody(`plugin:${this.pluginId}`, (body) => {
        if (!model || awaitingDetail) {
          createPageState(body, {
            kind: "loading",
            title: "Opening plugin",
            description: "Loading its capabilities and setup information.",
          });
        } else if (!detail) {
          createPageState(body, {
            kind: "error",
            title: "Plugin unavailable",
            description:
              "It may have been removed or the catalogue may have changed.",
            actionLabel: "Back to plugins",
            onAction: () => this.props.onNavigatePlugin(),
          });
        } else {
          if (model.pendingAuthentication)
            this.renderAuthentication(body, model);
          if (this.creating && this.editorSeed)
            this.renderEditor(body, model, this.editorSeed);
          else this.renderPluginDetail(body, model, detail);
        }
      });
      return;
    }

    shell.setTabs([
      {
        id: "installed",
        label: "Connections",
        count: model?.installedPlugins.length,
        active: model?.selectedTab !== "discover",
        onSelect: () => void this.changeView("installed", ""),
      },
      {
        id: "discover",
        label: "Verified",
        active: model?.selectedTab === "discover",
        onSelect: () => void this.changeView("discover", model?.query ?? ""),
      },
    ]);
    shell.updateBody(model?.selectedTab ?? "installed", (body) => {
      if (!model) {
        createPageState(body, {
          kind: error ? "error" : "loading",
          title: error ? "Plugins are unavailable" : "Loading plugins",
          description: error
            ? "Check the Chatobby runtime and try again."
            : "Reading installed capabilities.",
        });
        return;
      }
      if (model.pendingAuthentication) this.renderAuthentication(body, model);
      if (model.selectedTab === "discover") this.renderDiscover(body, model);
      else this.renderInstalled(body, model);
    });
    if (this.restoreListScroll && model) {
      shell.body.scrollTop = this.listScroll.get(model.selectedTab) ?? 0;
      this.restoreListScroll = false;
    }
  }

  private renderInstalled(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
  ): void {
    if (this.creating) this.renderEditor(parent, model);
    const plugins = this.filteredPlugins(
      model.installedPlugins,
      this.installedQuery,
    );
    this.renderFilterBar(
      parent,
      model,
      "installed",
      plugins.length,
      plugins.length,
      model.installedPlugins.length,
    );
    if (plugins.length === 0) {
      createPageState(parent, {
        kind: model.installedPlugins.length === 0 ? "empty" : "no-results",
        title:
          model.installedPlugins.length === 0
            ? "No connections added"
            : "No matching connections",
        description:
          model.installedPlugins.length === 0
            ? "Add a connection or choose one verified by Chatobby."
            : "Change the search or filters.",
      });
      return;
    }
    const chatobby = plugins.filter(
      (plugin) =>
        plugin.source === "built-in" || plugin.id === "chatobby:local-skills",
    );
    const verified = plugins.filter(
      (plugin) => plugin.source === "first-party",
    );
    const manual = plugins.filter(
      (plugin) =>
        plugin.source === "custom" && plugin.id !== "chatobby:local-skills",
    );
    this.renderPluginGroup(
      parent,
      "Chatobby",
      "Capabilities included with Chatobby and local skills available to this session.",
      chatobby,
    );
    this.renderPluginGroup(
      parent,
      "Verified connections",
      "Definitions reviewed and shipped by Chatobby. Connection state is separate from the active sandbox and network limits.",
      verified,
    );
    this.renderPluginGroup(
      parent,
      "Manual connections",
      "Connections from this project or your user configuration. Open one to inspect its reported identity, tools, and source.",
      manual,
    );
  }

  private renderPluginGroup(
    parent: HTMLElement,
    title: string,
    description: string,
    plugins: readonly FrontendChatobbyPluginSummary[],
  ): void {
    if (plugins.length === 0) return;
    const section = createPageSection(parent, {
      title,
      description,
      surface: "divided",
    });
    const list = section.content.createDiv({
      cls: "chatobby-mcp__plugin-list",
    });
    for (const plugin of plugins) this.renderPluginRow(list, plugin);
  }

  private renderDiscover(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
  ): void {
    const plugins = this.filteredPlugins(model.catalogPlugins, model.query);
    this.renderFilterBar(
      parent,
      model,
      "discover",
      plugins.length,
      plugins.length,
      model.catalogPlugins.length,
    );
    const section = createPageSection(parent, {
      title: model.query
        ? `Results for “${model.query}”`
        : "Verified by Chatobby",
      description:
        "A small catalogue of connection definitions that Chatobby reviews, tests, and ships with each release.",
      surface: "divided",
    });
    const list = section.content.createDiv({
      cls: "chatobby-mcp__plugin-list",
    });
    if (plugins.length === 0) {
      const filteredOut = model.catalogPlugins.length > 0;
      createPageState(list, {
        kind: model.query || filteredOut ? "no-results" : "empty",
        title:
          model.query || filteredOut
            ? "No matching verified plugins"
            : "No verified plugins in this release",
        description:
          model.query || filteredOut
            ? "Try a shorter name, another capability, or a different connection filter."
            : "You can still add a manual MCP connection.",
      });
    } else {
      for (const plugin of plugins) this.renderPluginRow(list, plugin);
    }
    const meta = parent.createDiv({ cls: "chatobby-mcp__coverage" });
    meta.createSpan({
      text: `${model.catalogPlugins.length} verified ${model.catalogPlugins.length === 1 ? "plugin" : "plugins"} in this Chatobby release`,
    });
  }

  private renderFilterBar(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    tab: "installed" | "discover",
    shown: number,
    matches: number,
    indexed: number,
  ): void {
    const toolbar = createPageToolbar(parent, "chatobby-mcp__filter-bar");
    const search = toolbar.createEl("input", {
      attr: {
        type: "search",
        placeholder:
          tab === "discover" ? "Search plugins" : "Filter installed plugins",
        "aria-label":
          tab === "discover" ? "Search plugins" : "Filter installed plugins",
        "data-page-state-key": `plugins:${tab}:query`,
      },
    });
    search.value = tab === "discover" ? model.query : this.installedQuery;
    if (tab === "discover") {
      search.addEventListener("input", () =>
        this.scheduleSearch(search.value.trim(), model.query),
      );
      search.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this.cancelScheduledSearch();
        void this.changeView("discover", search.value.trim());
      });
    } else {
      search.addEventListener("input", () => {
        this.installedQuery = search.value;
        this.renderState(this.props.getModel());
      });
    }
    const controls = toolbar.createDiv({
      cls: "chatobby-mcp__filter-controls",
    });
    const connection = controls.createEl("select", {
      attr: {
        "aria-label": "Filter by connection",
        "data-page-state-key": "plugins:connection",
      },
    });
    selectOptions(connection, [
      ["all", "Any connection"],
      ["remote", "Remote"],
      ["local", "Local"],
    ]);
    connection.value = this.connectionFilter;
    connection.addEventListener("change", () => {
      this.connectionFilter = isConnectionFilter(connection.value)
        ? connection.value
        : "all";
      this.renderState(this.props.getModel());
    });
    const sort = controls.createEl("select", {
      attr: {
        "aria-label": "Sort plugins",
        "data-page-state-key": "plugins:sort",
      },
    });
    selectOptions(sort, [
      [
        "relevance",
        tab === "discover" ? "Recommended order" : "Connection order",
      ],
      ["name", "Name"],
    ]);
    sort.value = this.sort;
    sort.addEventListener("change", () => {
      this.sort = isPluginSort(sort.value) ? sort.value : "relevance";
      this.renderState(this.props.getModel());
    });
    toolbar.createDiv({
      cls: "chatobby-mcp__result-count",
      text:
        shown < matches
          ? `${shown} of ${matches} shown`
          : matches < indexed
            ? `${matches} ${matches === 1 ? "match" : "matches"}`
            : `${matches} shown`,
      attr: { "aria-live": "polite" },
    });
  }

  private renderPluginRow(
    parent: HTMLElement,
    plugin: FrontendChatobbyPluginSummary,
  ): void {
    const row = parent.createEl("button", {
      cls: "chatobby-mcp__plugin-row",
      attr: {
        type: "button",
        "aria-label": `Open ${plugin.title}`,
        "data-page-focus-key": `plugin:${plugin.id}`,
      },
    });
    const icon = row.createSpan({
      cls: "chatobby-mcp__plugin-icon",
      attr: { "aria-hidden": "true" },
    });
    if (plugin.verifiedPublisher && plugin.brandIcon) {
      renderPluginBrandIcon(icon, plugin.brandIcon);
    } else {
      setIcon(icon, pluginIcon(plugin));
    }
    const copy = row.createSpan({ cls: "chatobby-mcp__plugin-copy" });
    const heading = copy.createSpan({ cls: "chatobby-mcp__plugin-heading" });
    heading.createSpan({
      cls: "chatobby-mcp__plugin-title",
      text: plugin.title,
    });
    if (plugin.verifiedPublisher) {
      const verified = heading.createSpan({
        cls: "chatobby-mcp__plugin-verified",
        attr: {
          "aria-label": "Verified by Chatobby",
          title: "Verified by Chatobby",
        },
      });
      setIcon(verified, "badge-check");
    }
    if (plugin.installed)
      heading.createSpan({
        cls: "chatobby-mcp__plugin-installed",
        text: "Installed",
      });
    copy.createSpan({
      cls: "chatobby-mcp__plugin-description",
      text: plugin.description,
    });
    copy.createSpan({
      cls: "chatobby-mcp__plugin-meta",
      text: [
        plugin.publisher,
        plugin.sourceLabel,
        plugin.transportLabel,
        plugin.version,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    const summary = row.createSpan({
      cls: "chatobby-mcp__plugin-capability-count",
      text: capabilityCountLabel(plugin),
    });
    summary.setAttr("title", capabilityCountTitle(plugin));
    const chevron = row.createSpan({
      cls: "chatobby-mcp__plugin-chevron",
      attr: { "aria-hidden": "true" },
    });
    setIcon(chevron, "chevron-right");
    row.addEventListener("click", () => this.props.onNavigatePlugin(plugin.id));
  }

  private renderPluginDetail(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    plugin: FrontendChatobbyPluginDetail,
  ): void {
    const overview = createPageSection(parent, {
      description: plugin.description,
      className: "chatobby-mcp__plugin-overview",
    });
    if (plugin.verifiedPublisher && plugin.brandIcon) {
      const identity = overview.content.createDiv({
        cls: "chatobby-mcp__verified-identity",
        attr: { "aria-label": "Verified by Chatobby" },
      });
      const mark = identity.createSpan({
        cls: "chatobby-mcp__detail-brand-icon",
        attr: { "aria-hidden": "true" },
      });
      renderPluginBrandIcon(mark, plugin.brandIcon);
      identity.createSpan({
        text: `Verified by Chatobby · ${plugin.publisher}`,
      });
    }
    const metadata = overview.content.createDiv({
      cls: "chatobby-mcp__detail-meta",
    });
    for (const value of [
      plugin.publisher,
      plugin.sourceLabel,
      plugin.transportLabel,
      plugin.version,
    ]) {
      if (value) metadata.createSpan({ text: value });
    }
    const actions = createPageActionRow(
      overview.content,
      "chatobby-mcp__detail-actions",
    );
    const repositoryUrl = safeExternalUrl(plugin.repositoryUrl);
    if (repositoryUrl) {
      actions.createEl("a", {
        text: "View source",
        href: repositoryUrl,
        attr: { target: "_blank", rel: "noopener noreferrer" },
      });
    }
    if (plugin.catalog?.canConfigure && !plugin.installed) {
      const catalog = plugin.catalog;
      const install = actions.createEl("button", {
        cls: "mod-cta",
        text: "Add disabled",
        attr: { type: "button" },
      });
      install.disabled = this.busy;
      install.addEventListener(
        "click",
        () =>
          void this.runIntent({
            type: "mcp.configure-verified",
            payload: {
              expectedConfigRevision: model.configRevision,
              pluginId: catalog.name,
              scope: "user",
            },
          }),
      );
    }
    if (plugin.server) {
      this.renderServerActions(overview.content, model, plugin.server);
      if (plugin.server.authentication === "bearer") {
        this.renderCredentialSelector(parent, model, plugin.server);
      }
      this.renderToolExposure(parent, model, plugin.server);
    }

    const otherCapabilities = plugin.capabilities.filter(
      (capability) =>
        capability.kind !== "mcp-tool" && capability.kind !== "mcp-resource",
    );
    if (otherCapabilities.length > 0)
      this.renderCapabilities(parent, otherCapabilities);
    if (plugin.setup.length > 0)
      this.renderDefinitionSection(parent, "Setup", plugin.setup);
    if (plugin.permissions.length > 0) {
      this.renderTextList(
        parent,
        "Access notes",
        "Review the service's own access separately from Chatobby's sandbox and network limits.",
        plugin.permissions,
      );
    }
    if (plugin.metrics.length > 0) {
      const section = createPageSection(parent, {
        title: "Activity",
        description:
          "Activity is informational and does not establish safety or quality.",
        surface: "divided",
      });
      for (const metric of plugin.metrics) {
        const row = section.content.createDiv({ cls: "chatobby-mcp__metric" });
        row.createSpan({ text: metric.label });
        const value = row.createSpan({ cls: "chatobby-mcp__metric-value" });
        const sourceUrl = safeExternalUrl(metric.sourceUrl);
        if (sourceUrl) {
          value.createEl("a", {
            text: metric.value.toLocaleString(),
            href: sourceUrl,
            attr: { target: "_blank", rel: "noopener noreferrer" },
          });
        } else {
          value.textContent = metric.value.toLocaleString();
        }
        row.createSpan({
          cls: "chatobby-mcp__metric-period",
          text: metric.period,
        });
      }
    }
    if (plugin.cautions.length > 0) {
      this.renderTextList(
        parent,
        "Before enabling",
        undefined,
        plugin.cautions,
        "warning",
      );
    }
  }

  private renderCapabilities(
    parent: HTMLElement,
    capabilities: readonly FrontendChatobbyPluginCapability[],
  ): void {
    const section = createPageSection(parent, {
      title: "Capabilities",
      description:
        "These are reported by the connection. Chatobby's sandbox and network limits remain separate.",
      surface: "divided",
    });
    for (const capability of capabilities) {
      const row = section.content.createDiv({
        cls: "chatobby-mcp__capability",
      });
      const icon = row.createSpan({
        cls: "chatobby-mcp__capability-icon",
        attr: { "aria-hidden": "true" },
      });
      setIcon(icon, capabilityIcon(capability.kind));
      const copy = row.createDiv({ cls: "chatobby-mcp__capability-copy" });
      copy.createDiv({
        cls: "chatobby-mcp__capability-title",
        text: capability.title,
      });
      copy.createDiv({
        cls: "chatobby-mcp__capability-description",
        text: capability.description,
      });
      if (capability.detail)
        row.createDiv({
          cls: "chatobby-mcp__capability-detail",
          text: capability.detail,
        });
    }
  }

  private renderDefinitionSection(
    parent: HTMLElement,
    title: string,
    values: readonly { readonly label: string; readonly value: string }[],
  ): void {
    const section = createPageSection(parent, { title, surface: "divided" });
    const definition = section.content.createEl("dl", {
      cls: "chatobby-mcp__definition",
    });
    for (const value of values) detail(definition, value.label, value.value);
  }

  private renderTextList(
    parent: HTMLElement,
    title: string,
    description: string | undefined,
    values: readonly string[],
    tone: "plain" | "warning" = "plain",
  ): void {
    const section = createPageSection(parent, {
      title,
      description,
      className:
        tone === "warning" ? "chatobby-mcp__warning-section" : undefined,
      surface: "divided",
    });
    const list = section.content.createEl("ul", {
      cls: "chatobby-mcp__text-list",
    });
    for (const value of values) list.createEl("li", { text: value });
  }

  private renderServerActions(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    server: FrontendMcpServerViewModel,
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
        () => void this.cancelServerOperation(server.id),
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
      review.disabled = this.busy;
      review.addEventListener("click", () => {
        this.editorSeed = server;
        this.creating = true;
        this.renderState(this.props.getModel());
      });
    }
    const toggle = actions.createEl("button", {
      text: server.enabled ? "Disable" : "Enable",
      attr: { type: "button" },
    });
    toggle.disabled = this.busy || server.builtIn || !server.writable;
    toggle.addEventListener(
      "click",
      () =>
        void this.runIntent({
          type: "mcp.set-enabled",
          payload: {
            expectedConfigRevision: model.configRevision,
            serverId: server.id,
            enabled: !server.enabled,
            scope: server.writable ? "user" : undefined,
          },
        }),
    );
    if (
      server.writable &&
      server.authentication === "oauth" &&
      (server.requiresAuthentication || server.state === "needs-sign-in")
    ) {
      action(actions, "Sign in", () =>
        this.simpleIntent("mcp.auth-start", server.id),
      );
    }
    if (server.enabled && server.state !== "connected") {
      const connect = action(actions, "Connect", () =>
        this.simpleIntent("mcp.connect", server.id),
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
        this.simpleIntent("mcp.disconnect", server.id),
      );
    }
    const discover = action(actions, "Test & discover", () =>
      this.simpleIntent("mcp.discover", server.id),
    );
    discover.disabled =
      this.busy ||
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
      this.simpleIntent("mcp.diagnostics", server.id),
    );
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
    if (this.removeConfirmId !== server.id) return;
    const confirm = parent.createDiv({ cls: "chatobby-mcp__confirm" });
    confirm.createDiv({
      text: `Remove ${server.id} from your Chatobby settings?`,
    });
    const confirmActions = createPageActionRow(confirm);
    action(confirmActions, "Cancel", () => {
      this.removeConfirmId = null;
      this.renderState(this.props.getModel());
    });
    const remove = confirmActions.createEl("button", {
      cls: "mod-warning",
      text: "Remove plugin",
      attr: { type: "button" },
    });
    remove.addEventListener(
      "click",
      () =>
        void this.runIntent(
          {
            type: "mcp.remove",
            payload: {
              serverId: server.id,
              expectedConfigRevision: model.configRevision,
              scope: "user",
            },
          },
          () => {
            this.removeConfirmId = null;
            this.props.onNavigatePlugin();
          },
        ),
    );
  }

  private renderToolExposure(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    server: FrontendMcpServerViewModel,
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
      checkbox.disabled = this.busy || server.builtIn || !server.writable;
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
      checkbox.addEventListener(
        "change",
        () =>
          void this.runIntent({
            type: "mcp.set-tool-enabled",
            payload: {
              expectedConfigRevision: model.configRevision,
              serverId: server.id,
              toolName: capability.name,
              enabled: checkbox.checked,
              scope: server.writable ? "user" : undefined,
            },
          }),
      );
    }
  }

  private renderCredentialSelector(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    server: FrontendMcpServerViewModel,
  ): void {
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
      this.props.app,
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
      void this.runIntent({
        type: "mcp.set-credential-reference",
        payload: {
          expectedConfigRevision: model.configRevision,
          serverId: server.id,
          reference,
          scope: server.writable ? "user" : undefined,
        },
      });
    });
  }

  private renderEditor(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    seed: FrontendMcpServerViewModel | null = null,
  ): void {
    const section = createPageSection(parent, {
      title: seed ? "Review and add connection" : "Add a connection",
      description: seed
        ? "This project suggested a connection. Review its address or command before saving a separate disabled copy in your Chatobby settings."
        : "Connections give Chatobby new tools from services or programs you choose. Nothing is enabled until you review it.",
      surface: "inset",
    });
    const form = section.content.createDiv({ cls: "chatobby-mcp__editor" });
    const introduction = form.createDiv({ cls: "chatobby-mcp__editor-intro" });
    const introductionIcon = introduction.createSpan({
      cls: "chatobby-mcp__editor-intro-icon",
      attr: { "aria-hidden": "true" },
    });
    setIcon(introductionIcon, "plug-zap");
    const introductionCopy = introduction.createDiv();
    introductionCopy.createDiv({
      cls: "chatobby-mcp__editor-intro-title",
      text: seed ? "Project suggestion" : "What would you like to connect?",
    });
    introductionCopy.createDiv({
      cls: "chatobby-mcp__editor-intro-copy",
      text: seed
        ? "The project file remains unchanged and cannot enable this connection or its tools."
        : "Choose a connection type below. If a service is already in Verified, use that guided setup instead.",
    });
    const browse = introduction.createEl("button", {
      text: "Browse Verified",
      attr: { type: "button" },
    });
    browse.addEventListener(
      "click",
      () => void this.changeView("discover", ""),
    );

    const transport = selectField(
      form,
      "Connection type",
      "mcp:new:transport",
      [
        ["remote", "Online service"],
        ["local", "Program on this computer"],
      ],
    );
    transport
      .closest<HTMLElement>(".chatobby-mcp__field")
      ?.addClass("chatobby-visually-hidden");
    const choices = form.createDiv({
      cls: "chatobby-mcp__connection-choices",
      attr: { role: "group", "aria-label": "Connection type" },
    });
    const remoteChoice = connectionChoice(
      choices,
      "cloud",
      "Online service",
      "Use a server address supplied by an app or service.",
      () => selectTransport("remote"),
    );
    const localChoice = connectionChoice(
      choices,
      "terminal-square",
      "Program on this computer",
      "Run a trusted command already installed on this device.",
      () => selectTransport("local"),
    );

    const basics = form.createDiv({ cls: "chatobby-mcp__editor-section" });
    basics.createDiv({
      cls: "chatobby-mcp__editor-section-title",
      text: "Connection details",
    });
    const name = inputField(
      basics,
      "Connection name",
      "mcp:new:name",
      "For example: GitHub or My calendar",
      "A short name you will recognize later.",
    );
    basics.createDiv({
      cls: "chatobby-mcp__save-note",
      text: "Saved in your Chatobby settings. Repository files and project instructions cannot register, enable, or change agent tool access.",
    });

    const remoteFields = form.createDiv({
      cls: "chatobby-mcp__editor-section chatobby-mcp__remote-fields",
    });
    remoteFields.createDiv({
      cls: "chatobby-mcp__editor-section-title",
      text: "Online service",
    });
    const url = inputField(
      remoteFields,
      "Server address",
      "mcp:new:url",
      "https://example.com/mcp",
      "Paste the MCP address supplied by the service.",
    );
    const authentication = selectField(
      remoteFields,
      "How do you sign in?",
      "mcp:new:auth",
      [
        ["oauth", "Browser sign-in"],
        ["bearer", "Token stored by Obsidian"],
        ["none", "No sign-in"],
      ],
      "Choose the method documented by the service. Chatobby never stores the token value in its settings.",
    );
    const bearerField = secretReferenceField(
      this.props.app,
      remoteFields,
      "Saved access token",
      "mcp:new:credential",
      "",
    );

    const localFields = form.createDiv({
      cls: "chatobby-mcp__editor-section chatobby-mcp__local-fields",
    });
    localFields.createDiv({
      cls: "chatobby-mcp__editor-section-title",
      text: "Program on this computer",
    });
    const command = inputField(
      localFields,
      "Program or command",
      "mcp:new:command",
      "For example: npx",
      "Use the command from the server's installation instructions.",
    );
    const argumentsInput = textAreaField(
      localFields,
      "Arguments",
      "mcp:new:arguments",
      "Put each argument on its own line.",
    );
    const workingDirectory = inputField(
      localFields,
      "Working folder",
      "mcp:new:cwd",
      "Optional",
      "Leave blank unless the server requires a particular folder.",
    );

    const advanced = form.createEl("details", {
      cls: "chatobby-mcp__advanced",
    });
    advanced.createEl("summary", { text: "Advanced options" });
    const advancedBody = advanced.createDiv({
      cls: "chatobby-mcp__advanced-body",
    });
    const lifecycle = selectField(
      advancedBody,
      "When should Chatobby start it?",
      "mcp:new:lifecycle",
      [
        ["lazy", "Only when one of its tools is used"],
        ["keep-alive", "Keep it available after first use"],
        ["eager", "When Chatobby starts"],
      ],
    );
    const environment = textAreaField(
      advancedBody,
      "Environment variables",
      "mcp:new:environment",
      "Use NAME=ENV_VARIABLE, one per line. Values come from the existing environment.",
    );
    const headers = textAreaField(
      advancedBody,
      "Request headers",
      "mcp:new:headers",
      "Use HEADER=ENV_VARIABLE, one per line. Values come from the existing environment.",
    );
    const refreshTransport = (): void => {
      const remote = transport.value === "remote";
      remoteFields.toggleClass("is-hidden", !remote);
      localFields.toggleClass("is-hidden", remote);
      bearerField.wrapper.toggleClass(
        "is-hidden",
        !remote || authentication.value !== "bearer",
      );
      headers
        .closest<HTMLElement>(".chatobby-mcp__field")
        ?.toggleClass("is-hidden", !remote);
      environment
        .closest<HTMLElement>(".chatobby-mcp__field")
        ?.toggleClass("is-hidden", remote);
      remoteChoice.setAttr("aria-pressed", String(remote));
      localChoice.setAttr("aria-pressed", String(!remote));
      remoteChoice.toggleClass("is-selected", remote);
      localChoice.toggleClass("is-selected", !remote);
    };
    const selectTransport = (value: "remote" | "local"): void => {
      transport.value = value;
      refreshTransport();
    };
    transport.addEventListener("change", refreshTransport);
    authentication.addEventListener("change", refreshTransport);
    if (seed) {
      name.value = seed.id;
      transport.value = seed.transport;
      command.value = seed.command ?? "";
      argumentsInput.value = seed.arguments.join("\n");
      workingDirectory.value = seed.workingDirectory ?? "";
      url.value = seed.url ?? "";
      authentication.value = seed.authentication;
      lifecycle.value = "lazy";
    }
    refreshTransport();
    form.createDiv({
      cls: "chatobby-mcp__save-note",
      text: "Saving creates a disabled connection with no exposed tools. Check details validates this form only; it does not contact or start the server. Test and select tools after saving.",
    });
    const validation = form.createDiv({
      cls: "chatobby-mcp__form-validation is-hidden",
      attr: { role: "alert", "aria-live": "polite" },
    });
    const validateDraft = (): FrontendMcpServerDraft | null => {
      const fields = [name, url, command, bearerField.select, environment, headers];
      for (const field of fields) field.removeAttribute("aria-invalid");
      const errors: string[] = [];
      let firstInvalid: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
      const reject = (field: typeof firstInvalid, message: string): void => {
        errors.push(message);
        field?.setAttribute("aria-invalid", "true");
        firstInvalid ??= field;
      };
      if (!name.value.trim()) reject(name, "Enter a connection name.");
      if (transport.value === "local") {
        if (!command.value.trim()) reject(command, "Enter the program or command to run.");
      } else {
        if (!url.value.trim()) reject(url, "Enter the server address.");
        else if (!safeExternalUrl(url.value.trim())) reject(url, "Use a complete server address starting with http:// or https://.");
        if (authentication.value === "bearer" && !bearerField.select.value)
          reject(bearerField.select, "Choose a saved access token.");
      }
      for (const field of transport.value === "local" ? [environment] : [headers]) {
        try { mappings(field.value); }
        catch { reject(field, "Use NAME=ENV_VARIABLE, one mapping per line."); }
      }
      validation.textContent = errors.join(" ");
      validation.toggleClass("is-hidden", errors.length === 0);
      if (errors.length) { firstInvalid?.focus(); return null; }
      return collectDraft();
    };
    const actions = createPageActionRow(form);
    action(actions, "Cancel", () => {
      this.creating = false;
      this.editorSeed = null;
      this.renderState(this.props.getModel());
    });
    const preview = actions.createEl("button", {
      text: "Check details",
      attr: { type: "button" },
    });
    preview.addEventListener(
      "click",
      () => {
        const draft = validateDraft();
        if (!draft) return;
        void this.runIntent({
          type: "mcp.preview",
          payload: { draft },
        });
      },
    );
    const save = actions.createEl("button", {
      cls: "mod-cta",
      text: "Save connection",
      attr: { type: "button" },
    });
    save.addEventListener(
      "click",
      () => {
        const draft = validateDraft();
        if (!draft) return;
        void this.runIntent(
          {
            type: "mcp.save",
            payload: {
              expectedConfigRevision: model.configRevision,
              draft,
            },
          },
          () => {
            this.creating = false;
            this.editorSeed = null;
          },
        );
      },
    );

    const collectDraft = (): FrontendMcpServerDraft => ({
      name: name.value.trim(),
      scope: "user",
      enabled: false,
      lifecycle: isLifecycle(lifecycle.value) ? lifecycle.value : "lazy",
      transport: transport.value === "local" ? "local" : "remote",
      command: command.value.trim() || undefined,
      arguments: lines(argumentsInput.value),
      workingDirectory: workingDirectory.value.trim() || undefined,
      url: url.value.trim() || undefined,
      authentication: isAuthentication(authentication.value)
        ? authentication.value
        : "oauth",
      bearerCredentialReference: bearerField.select.value || undefined,
      environment: transport.value === "local" ? mappings(environment.value) : [],
      headers: transport.value === "local" ? [] : mappings(headers.value),
    });
  }

  private renderAuthentication(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
  ): void {
    const pending = model.pendingAuthentication;
    if (!pending) return;
    const section = createPageSection(parent, {
      title: `Sign in to ${pending.serverId}`,
      description:
        "Open the sign-in page, then paste the returned code or redirect URL.",
      surface: "inset",
    });
    const authorizationUrl = safeExternalUrl(pending.authorizationUrl);
    if (authorizationUrl) {
      section.content.createEl("a", {
        text: "Open sign-in page",
        href: authorizationUrl,
        attr: { target: "_blank", rel: "noopener noreferrer" },
      });
    }
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
    complete.addEventListener(
      "click",
      () =>
        void this.runIntent({
          type: "mcp.auth-complete",
          payload: { serverId: pending.serverId, input: input.value.trim() },
        }),
    );
  }

  private filteredPlugins(
    plugins: readonly FrontendChatobbyPluginSummary[],
    query: string,
  ): readonly FrontendChatobbyPluginSummary[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = plugins.filter((plugin) => {
      if (
        this.connectionFilter !== "all" &&
        plugin.transport !== this.connectionFilter
      )
        return false;
      if (!normalizedQuery) return true;
      return `${plugin.title} ${plugin.description} ${plugin.publisher} ${plugin.sourceLabel}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
    if (this.sort === "name")
      return [...filtered].sort((left, right) =>
        left.title.localeCompare(right.title),
      );
    return filtered;
  }

  private scheduleSearch(query: string, currentQuery: string): void {
    this.cancelScheduledSearch();
    if (query === currentQuery) return;
    this.searchTimer = window.setTimeout(() => {
      this.searchTimer = null;
      void this.changeView("discover", query);
    }, SEARCH_DEBOUNCE_MS);
  }

  private cancelScheduledSearch(): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }

  private simpleIntent(
    type:
      | "mcp.discover"
      | "mcp.connect"
      | "mcp.disconnect"
      | "mcp.auth-start"
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
    await this.runIntent({
      type: "mcp.set-view",
      payload: { tab, query, cursor },
    });
  }

  private async refresh(): Promise<void> {
    this.localError = null;
    try {
      await this.props.onRefresh();
    } catch (error) {
      this.setLocalError(errorMessage(error));
    }
  }

  private async runIntent(
    intent: McpViewIntent,
    onSuccess?: () => void,
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onIntent(intent);
      onSuccess?.();
    } catch (error) {
      const cancelledServerId =
        intent.type === "mcp.connect" || intent.type === "mcp.discover"
          ? intent.payload.serverId
          : undefined;
      if (
        !cancelledServerId ||
        !this.cancelledServerIds.has(cancelledServerId)
      ) {
        this.localError = errorMessage(error);
      }
    } finally {
      if (intent.type === "mcp.connect" || intent.type === "mcp.discover") {
        this.cancelledServerIds.delete(intent.payload.serverId);
      }
      this.busy = false;
      this.renderState(this.props.getModel());
    }
  }

  private async cancelServerOperation(serverId: string): Promise<void> {
    if (this.cancelledServerIds.has(serverId)) return;
    this.cancelledServerIds.add(serverId);
    try {
      await this.props.onIntent({
        type: "mcp.disconnect",
        payload: { serverId },
      });
      this.localError = null;
    } catch (error) {
      this.cancelledServerIds.delete(serverId);
      this.localError = errorMessage(error);
    }
    this.renderState(this.props.getModel());
  }
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

interface SecretReferenceField {
  readonly wrapper: HTMLElement;
  readonly select: HTMLSelectElement;
  onSecretsChanged(listener: () => void): void;
}

function secretReferenceField(
  app: App,
  parent: HTMLElement,
  label: string,
  key: string,
  initialReference: string,
): SecretReferenceField {
  const wrapper = parent.createDiv({ cls: "chatobby-mcp__secret-field" });
  const field = wrapper.createEl("label", { cls: "chatobby-mcp__field" });
  field.createSpan({ text: label });
  const select = field.createEl("select", {
    attr: {
      "aria-label": label,
      "data-page-state-key": key,
    },
  });
  const listeners = new Set<() => void>();
  const refresh = (preferredReference = select.value): void => {
    const references = app.secretStorage
      .listSecrets()
      .sort((left, right) => left.localeCompare(right));
    select.empty();
    const empty = select.createEl("option", { text: "Choose a saved token…" });
    empty.value = "";
    for (const reference of references) {
      const option = select.createEl("option", { text: reference });
      option.value = reference;
    }
    select.value = references.includes(preferredReference)
      ? preferredReference
      : references.includes(initialReference)
        ? initialReference
        : "";
    for (const listener of listeners) listener();
  };
  refresh(initialReference);

  const management = wrapper.createDiv({
    cls: "chatobby-mcp__secret-management",
  });
  management.createSpan({
    cls: "chatobby-mcp__secret-help",
    text: "Need another token? Add or manage it in Obsidian, then refresh this list.",
  });
  const controls = createPageActionRow(management);
  new SecretComponent(app, controls)
    .setValue("")
    .onChange((reference) => refresh(reference || ""));
  action(controls, "Refresh saved tokens", () => refresh());

  return {
    wrapper,
    select,
    onSecretsChanged: (listener) => {
      listeners.add(listener);
    },
  };
}

function inputField(
  parent: HTMLElement,
  label: string,
  key: string,
  placeholder: string,
  help?: string,
): HTMLInputElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const input = wrapper.createEl("input", {
    attr: { placeholder, "data-page-state-key": key },
  });
  if (help) wrapper.createSpan({ cls: "chatobby-mcp__field-help", text: help });
  return input;
}

function textAreaField(
  parent: HTMLElement,
  label: string,
  key: string,
  help?: string,
): HTMLTextAreaElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const textarea = wrapper.createEl("textarea", {
    attr: { rows: "3", "data-page-state-key": key },
  });
  if (help) wrapper.createSpan({ cls: "chatobby-mcp__field-help", text: help });
  return textarea;
}

function selectField(
  parent: HTMLElement,
  label: string,
  key: string,
  options: readonly (readonly [string, string])[],
  help?: string,
): HTMLSelectElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-mcp__field" });
  wrapper.createSpan({ text: label });
  const select = wrapper.createEl("select", {
    attr: { "data-page-state-key": key },
  });
  selectOptions(select, options);
  if (help) wrapper.createSpan({ cls: "chatobby-mcp__field-help", text: help });
  return select;
}

function connectionChoice(
  parent: HTMLElement,
  iconName: string,
  title: string,
  description: string,
  onChoose: () => void,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "chatobby-mcp__connection-choice",
    attr: { type: "button", "aria-pressed": "false" },
  });
  const icon = button.createSpan({
    cls: "chatobby-mcp__connection-choice-icon",
    attr: { "aria-hidden": "true" },
  });
  setIcon(icon, iconName);
  const copy = button.createSpan({
    cls: "chatobby-mcp__connection-choice-copy",
  });
  copy.createSpan({
    cls: "chatobby-mcp__connection-choice-title",
    text: title,
  });
  copy.createSpan({
    cls: "chatobby-mcp__connection-choice-description",
    text: description,
  });
  button.addEventListener("click", onChoose);
  return button;
}

function selectOptions(
  select: HTMLSelectElement,
  options: readonly (readonly [string, string])[],
): void {
  for (const [value, text] of options) {
    const option = select.createEl("option", { text });
    option.value = value;
  }
}

function action(
  parent: HTMLElement,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    text: label,
    attr: { type: "button" },
  });
  button.addEventListener("click", onClick);
  return button;
}

function detail(parent: HTMLElement, label: string, value: string): void {
  parent.createEl("dt", { text: label });
  parent.createEl("dd", { text: value || "Not set" });
}

function lines(value: string): readonly string[] {
  return value
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function isLifecycle(
  value: string,
): value is FrontendMcpServerDraft["lifecycle"] {
  return value === "lazy" || value === "eager" || value === "keep-alive";
}

function isAuthentication(
  value: string,
): value is NonNullable<FrontendMcpServerDraft["authentication"]> {
  return value === "oauth" || value === "bearer" || value === "none";
}

function isConnectionFilter(value: string): value is PluginConnectionFilter {
  return value === "all" || value === "remote" || value === "local";
}

function isPluginSort(value: string): value is PluginSort {
  return value === "relevance" || value === "name";
}

function pluginSubtitle(plugin: FrontendChatobbyPluginDetail): string {
  return [plugin.publisher, plugin.version, plugin.sourceLabel]
    .filter(Boolean)
    .join(" · ");
}

function pluginIcon(plugin: FrontendChatobbyPluginSummary): string {
  if (plugin.id === "chatobby:local-skills") return "sparkles";
  if (plugin.source === "built-in") return "box";
  if (plugin.transport === "remote") return "cloud";
  return "plug";
}

function capabilityIcon(
  kind: FrontendChatobbyPluginCapability["kind"],
): string {
  if (kind === "mcp-tool") return "wrench";
  if (kind === "mcp-resource") return "file-box";
  if (kind === "skill") return "sparkles";
  if (kind === "command") return "terminal";
  if (kind === "workflow") return "workflow";
  return "plug";
}

function capabilityCountLabel(plugin: FrontendChatobbyPluginSummary): string {
  const counts = plugin.capabilityCounts;
  const values = [
    counts.mcpServers > 0
      ? `${counts.mcpServers} ${counts.mcpServers === 1 ? "server" : "servers"}`
      : "",
    counts.skills > 0
      ? `${counts.skills} ${counts.skills === 1 ? "skill" : "skills"}`
      : "",
    counts.commands > 0
      ? `${counts.commands} ${counts.commands === 1 ? "command" : "commands"}`
      : "",
  ].filter(Boolean);
  return values.join(" · ") || "Plugin";
}

function capabilityCountTitle(plugin: FrontendChatobbyPluginSummary): string {
  const counts = plugin.capabilityCounts;
  return [
    `${counts.mcpServers} MCP servers`,
    `${counts.skills} skills`,
    `${counts.commands} commands`,
    `${counts.workflows} workflows`,
  ].join(", ");
}

function safeExternalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
