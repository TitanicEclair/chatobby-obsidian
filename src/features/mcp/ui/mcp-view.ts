import { SecretComponent, setIcon, type App } from "obsidian";
import type {
  FrontendMcpServerDraft,
  FrontendMcpServerViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type {
  FrontendChatobbyPluginCapability,
  FrontendChatobbyPluginDetail,
  FrontendChatobbyPluginSource,
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
  | { readonly type: "mcp.set-credential-reference"; readonly payload: {
      readonly expectedConfigRevision: string;
      readonly serverId: string;
      readonly reference: string;
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
  app: App;
  getModel(): FrontendPluginMcpScreenViewModel | null;
  subscribe(listener: (model: FrontendPluginMcpScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onNavigatePlugin(pluginId?: string): void;
  onIntent(intent: McpViewIntent): Promise<void>;
  initialPluginId?: string;
}

type PluginSourceFilter = "all" | FrontendChatobbyPluginSource;
type PluginConnectionFilter = "all" | "remote" | "local";
type PluginSort = "relevance" | "name" | "updated";

const SEARCH_DEBOUNCE_MS = 300;
const DISCOVER_PAGE_SIZE = 20;

export class McpView extends ChatobbyComponent {
  private readonly props: McpViewProps;
  private unsubscribe: (() => void) | null = null;
  private shell: PageShell | null = null;
  private backButton: HTMLButtonElement | null = null;
  private addButton: HTMLButtonElement | null = null;
  private refreshButton: HTMLButtonElement | null = null;
  private pluginId: string | undefined;
  private creating = false;
  private removeConfirmId: string | null = null;
  private localError: string | null = null;
  private busy = false;
  private installedQuery = "";
  private sourceFilter: PluginSourceFilter = "all";
  private connectionFilter: PluginConnectionFilter = "all";
  private sort: PluginSort = "relevance";
  private discoverResultKey = "";
  private discoverVisibleCount = DISCOVER_PAGE_SIZE;
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
    this.backButton = createPageIconButton(this.shell.actions, "arrow-left", "Back to plugins");
    this.backButton.addClass("is-hidden");
    this.backButton.addEventListener("click", () => this.props.onNavigatePlugin());
    this.addButton = createPageIconButton(this.shell.actions, "plus", "Add custom plugin");
    this.addButton.addEventListener("click", () => {
      this.creating = true;
      this.renderState(this.props.getModel());
    });
    this.refreshButton = createPageIconButton(this.shell.actions, "refresh-cw", "Refresh plugins");
    this.refreshButton.addEventListener("click", () => void this.refresh());
    createPageIconButton(this.shell.actions, "x", "Close plugins")
      .addEventListener("click", () => this.props.onBack());
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
    const awaitingDetail = Boolean(this.pluginId && model?.selectedPluginId !== this.pluginId);
    shell.setBusy(this.busy || awaitingDetail);
    this.refreshButton?.toggleClass("is-loading", model?.loading ?? false);
    this.refreshButton?.setAttr("aria-busy", String(model?.loading ?? false));
    this.backButton?.toggleClass("is-hidden", !this.pluginId);
    this.addButton?.toggleClass("is-hidden", Boolean(this.pluginId));
    shell.setTitle(detail?.title ?? (this.pluginId ? "Plugin" : "Plugins"), detail ? pluginSubtitle(detail) : undefined);
    shell.setStatus(
      error
        ? { tone: "error", message: error, actionLabel: "Try again", onAction: () => void this.refresh() }
        : model?.statusMessage
          ? { tone: "success", message: model.statusMessage }
          : model?.catalogError
            ? {
                tone: "warning",
                message: "The public plugin catalogue is temporarily unavailable. Installed and featured plugins still work.",
                actionLabel: "Try again",
                onAction: () => void this.refresh(),
              }
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
            description: "It may have been removed or the catalogue may have changed.",
            actionLabel: "Back to plugins",
            onAction: () => this.props.onNavigatePlugin(),
          });
        } else {
          if (model.pendingAuthentication) this.renderAuthentication(body, model);
          this.renderPluginDetail(body, model, detail);
        }
      });
      return;
    }

    shell.setTabs([
      {
        id: "installed",
        label: "Installed",
        count: model?.installedPlugins.length,
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
          title: error ? "Plugins are unavailable" : "Loading plugins",
          description: error ? "Check the Chatobby runtime and try again." : "Reading installed capabilities.",
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

  private renderInstalled(parent: HTMLElement, model: FrontendPluginMcpScreenViewModel): void {
    if (this.creating) this.renderEditor(parent, model);
    const plugins = this.filteredPlugins(model.installedPlugins, this.installedQuery);
    this.renderFilterBar(
      parent,
      model,
      "installed",
      plugins.length,
      plugins.length,
      model.installedPlugins.length,
    );
    const section = createPageSection(parent, {
      title: "Installed plugins",
      description: "Plugins group related capabilities. Their tools still follow the active permission policy.",
      surface: "divided",
    });
    const list = section.content.createDiv({ cls: "chatobby-mcp__plugin-list" });
    if (plugins.length === 0) {
      createPageState(list, {
        kind: model.installedPlugins.length === 0 ? "empty" : "no-results",
        title: model.installedPlugins.length === 0 ? "No plugins installed" : "No matching plugins",
        description: model.installedPlugins.length === 0
          ? "Add a custom connection or discover a plugin."
          : "Change the search or filters.",
      });
      return;
    }
    for (const plugin of plugins) this.renderPluginRow(list, plugin);
  }

  private renderDiscover(parent: HTMLElement, model: FrontendPluginMcpScreenViewModel): void {
    const plugins = this.filteredPlugins(model.catalogPlugins, model.query);
    const resultKey = [
      model.query,
      this.sourceFilter,
      this.connectionFilter,
      this.sort,
    ].join("\u0000");
    if (resultKey !== this.discoverResultKey) {
      this.discoverResultKey = resultKey;
      this.discoverVisibleCount = DISCOVER_PAGE_SIZE;
    }
    const visiblePlugins = plugins.slice(0, this.discoverVisibleCount);
    this.renderFilterBar(
      parent,
      model,
      "discover",
      visiblePlugins.length,
      plugins.length,
      model.catalogPlugins.length,
    );
    const section = createPageSection(parent, {
      title: model.query ? `Results for “${model.query}”` : "Discover plugins",
      description: "Reference and registry entries are shown separately. Registry presence is not a safety endorsement.",
      surface: "divided",
    });
    const list = section.content.createDiv({ cls: "chatobby-mcp__plugin-list" });
    if (plugins.length === 0) {
      const catalogueAvailable = model.catalogPlugins.length > 0;
      createPageState(list, {
        kind: model.query || catalogueAvailable ? "no-results" : "empty",
        title: model.query || catalogueAvailable ? "No matching plugins" : "No catalogue results",
        description: model.query
          ? "Try a shorter name, another capability, or fewer filters."
          : catalogueAvailable
            ? "Change the source or connection filter."
            : "Refresh when the MCP Registry is available.",
      });
    } else {
      for (const plugin of visiblePlugins) this.renderPluginRow(list, plugin);
    }
    const meta = parent.createDiv({ cls: "chatobby-mcp__coverage" });
    meta.createSpan({
      text: `${model.catalogPlugins.length} catalogue ${model.catalogPlugins.length === 1 ? "entry" : "entries"} indexed`,
    });
    const hiddenMatches = Math.max(0, plugins.length - visiblePlugins.length);
    const canIndexMore = Boolean(
      model.nextCatalogCursor
      && (this.sourceFilter === "all" || this.sourceFilter === "community"),
    );
    if (hiddenMatches > 0 || canIndexMore) {
      const more = meta.createEl("button", {
        text: hiddenMatches > 0
          ? `Show ${Math.min(DISCOVER_PAGE_SIZE, hiddenMatches)} more`
          : "Find more plugins",
        attr: { type: "button" },
      });
      more.addEventListener("click", () => {
        this.discoverVisibleCount += DISCOVER_PAGE_SIZE;
        if (hiddenMatches > 0) {
          this.renderState(this.props.getModel());
          return;
        }
        void this.changeView("discover", model.query, model.nextCatalogCursor);
      });
    }
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
        placeholder: tab === "discover" ? "Search plugins" : "Filter installed plugins",
        "aria-label": tab === "discover" ? "Search plugins" : "Filter installed plugins",
        "data-page-state-key": `plugins:${tab}:query`,
      },
    });
    search.value = tab === "discover" ? model.query : this.installedQuery;
    if (tab === "discover") {
      search.addEventListener("input", () => this.scheduleSearch(search.value.trim(), model.query));
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
    const controls = toolbar.createDiv({ cls: "chatobby-mcp__filter-controls" });
    const source = controls.createEl("select", {
      attr: { "aria-label": "Filter by source", "data-page-state-key": "plugins:source" },
    });
    selectOptions(source, [
      ["all", "All sources"],
      ["built-in", "Built in"],
      ["reference", "MCP reference"],
      ["first-party", "First-party"],
      ["community", "Community"],
      ["custom", "Custom"],
    ]);
    source.value = this.sourceFilter;
    source.addEventListener("change", () => {
      this.sourceFilter = isSourceFilter(source.value) ? source.value : "all";
      this.renderState(this.props.getModel());
    });
    const connection = controls.createEl("select", {
      attr: { "aria-label": "Filter by connection", "data-page-state-key": "plugins:connection" },
    });
    selectOptions(connection, [
      ["all", "Any connection"],
      ["remote", "Remote"],
      ["local", "Local"],
    ]);
    connection.value = this.connectionFilter;
    connection.addEventListener("change", () => {
      this.connectionFilter = isConnectionFilter(connection.value) ? connection.value : "all";
      this.renderState(this.props.getModel());
    });
    const sort = controls.createEl("select", {
      attr: { "aria-label": "Sort plugins", "data-page-state-key": "plugins:sort" },
    });
    selectOptions(sort, [
      ["relevance", tab === "discover" ? "Recommended order" : "Installed order"],
      ["name", "Name"],
      ["updated", "Recently updated"],
    ]);
    sort.value = this.sort;
    sort.addEventListener("change", () => {
      this.sort = isPluginSort(sort.value) ? sort.value : "relevance";
      this.renderState(this.props.getModel());
    });
    toolbar.createDiv({
      cls: "chatobby-mcp__result-count",
      text: shown < matches
        ? `${shown} of ${matches} shown`
        : matches < indexed
          ? `${matches} ${matches === 1 ? "match" : "matches"}`
          : `${matches} shown`,
      attr: { "aria-live": "polite" },
    });
  }

  private renderPluginRow(parent: HTMLElement, plugin: FrontendChatobbyPluginSummary): void {
    const row = parent.createEl("button", {
      cls: "chatobby-mcp__plugin-row",
      attr: {
        type: "button",
        "aria-label": `Open ${plugin.title}`,
        "data-page-focus-key": `plugin:${plugin.id}`,
      },
    });
    const icon = row.createSpan({ cls: "chatobby-mcp__plugin-icon", attr: { "aria-hidden": "true" } });
    if (plugin.verifiedPublisher && plugin.brandIcon) {
      renderPluginBrandIcon(icon, plugin.brandIcon);
    } else {
      setIcon(icon, pluginIcon(plugin));
    }
    const copy = row.createSpan({ cls: "chatobby-mcp__plugin-copy" });
    const heading = copy.createSpan({ cls: "chatobby-mcp__plugin-heading" });
    heading.createSpan({ cls: "chatobby-mcp__plugin-title", text: plugin.title });
    if (plugin.verifiedPublisher) {
      const verified = heading.createSpan({
        cls: "chatobby-mcp__plugin-verified",
        attr: { "aria-label": "Verified publisher", title: "Verified publisher" },
      });
      setIcon(verified, "badge-check");
    }
    if (plugin.installed) heading.createSpan({ cls: "chatobby-mcp__plugin-installed", text: "Installed" });
    copy.createSpan({ cls: "chatobby-mcp__plugin-description", text: plugin.description });
    copy.createSpan({
      cls: "chatobby-mcp__plugin-meta",
      text: [plugin.publisher, plugin.sourceLabel, plugin.transportLabel, plugin.version]
        .filter(Boolean)
        .join(" · "),
    });
    const summary = row.createSpan({
      cls: "chatobby-mcp__plugin-capability-count",
      text: capabilityCountLabel(plugin),
    });
    summary.setAttr("title", capabilityCountTitle(plugin));
    const chevron = row.createSpan({ cls: "chatobby-mcp__plugin-chevron", attr: { "aria-hidden": "true" } });
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
        attr: { "aria-label": "Verified publisher" },
      });
      const mark = identity.createSpan({
        cls: "chatobby-mcp__detail-brand-icon",
        attr: { "aria-hidden": "true" },
      });
      renderPluginBrandIcon(mark, plugin.brandIcon);
      identity.createSpan({ text: `Verified publisher · ${plugin.publisher}` });
    }
    const metadata = overview.content.createDiv({ cls: "chatobby-mcp__detail-meta" });
    for (const value of [plugin.publisher, plugin.sourceLabel, plugin.transportLabel, plugin.version]) {
      if (value) metadata.createSpan({ text: value });
    }
    const actions = createPageActionRow(overview.content, "chatobby-mcp__detail-actions");
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
      install.addEventListener("click", () => void this.runIntent({
        type: "mcp.configure-registry",
        payload: {
          expectedConfigRevision: model.configRevision,
          registryName: catalog.name,
          registryVersion: catalog.version,
          scope: "project",
        },
      }));
    }
    if (plugin.server) {
      this.renderServerActions(overview.content, model, plugin.server);
      if (plugin.server.authentication === "bearer") {
        this.renderCredentialSelector(parent, model, plugin.server);
      }
    }

    this.renderCapabilities(parent, plugin.capabilities);
    if (plugin.setup.length > 0) this.renderDefinitionSection(parent, "Setup", plugin.setup);
    if (plugin.permissions.length > 0) {
      this.renderTextList(
        parent,
        "Permissions",
        "Installing a plugin does not grant these capabilities automatically.",
        plugin.permissions,
      );
    }
    if (plugin.metrics.length > 0) {
      const section = createPageSection(parent, {
        title: "Activity",
        description: "Popularity is informational and does not establish safety or quality.",
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
        row.createSpan({ cls: "chatobby-mcp__metric-period", text: metric.period });
      }
    }
    if (plugin.cautions.length > 0) {
      this.renderTextList(parent, "Before enabling", undefined, plugin.cautions, "warning");
    }
  }

  private renderCapabilities(
    parent: HTMLElement,
    capabilities: readonly FrontendChatobbyPluginCapability[],
  ): void {
    const section = createPageSection(parent, {
      title: "Capabilities",
      description: "Only enabled capabilities that pass the active policy are available to agents.",
      surface: "divided",
    });
    for (const capability of capabilities) {
      const row = section.content.createDiv({ cls: "chatobby-mcp__capability" });
      const icon = row.createSpan({ cls: "chatobby-mcp__capability-icon", attr: { "aria-hidden": "true" } });
      setIcon(icon, capabilityIcon(capability.kind));
      const copy = row.createDiv({ cls: "chatobby-mcp__capability-copy" });
      copy.createDiv({ cls: "chatobby-mcp__capability-title", text: capability.title });
      copy.createDiv({ cls: "chatobby-mcp__capability-description", text: capability.description });
      if (capability.detail) row.createDiv({ cls: "chatobby-mcp__capability-detail", text: capability.detail });
    }
  }

  private renderDefinitionSection(
    parent: HTMLElement,
    title: string,
    values: readonly { readonly label: string; readonly value: string }[],
  ): void {
    const section = createPageSection(parent, { title, surface: "divided" });
    const definition = section.content.createEl("dl", { cls: "chatobby-mcp__definition" });
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
      className: tone === "warning" ? "chatobby-mcp__warning-section" : undefined,
      surface: "divided",
    });
    const list = section.content.createEl("ul", { cls: "chatobby-mcp__text-list" });
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
        text: server.state === "connecting" ? "Connecting…" : "Refreshing capabilities…",
        attr: { role: "status", "aria-live": "polite" },
      });
      action(
        actions,
        server.state === "connecting" ? "Cancel connection" : "Stop refresh",
        () => void this.cancelServerOperation(server.id),
      );
      return;
    }
    const toggle = actions.createEl("button", {
      text: server.enabled ? "Disable" : "Enable",
      attr: { type: "button" },
    });
    toggle.disabled = this.busy || server.builtIn || !server.writable;
    toggle.addEventListener("click", () => void this.runIntent({
      type: "mcp.set-enabled",
      payload: {
        expectedConfigRevision: model.configRevision,
        serverId: server.id,
        enabled: !server.enabled,
        scope: server.writable ? writableScope(server.sourceScope) : undefined,
      },
    }));
    if (
      server.authentication === "oauth"
      && (server.requiresAuthentication || server.state === "needs-sign-in")
    ) {
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
      action(actions, "Update", () => void this.runIntent({
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
    if (this.removeConfirmId !== server.id) return;
    const confirm = parent.createDiv({ cls: "chatobby-mcp__confirm" });
    confirm.createDiv({
      text: `Remove ${server.id} from ${server.sourceScope === "project" ? "this project" : "your Chatobby settings"}?`,
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
    remove.addEventListener("click", () => void this.runIntent({
      type: "mcp.remove",
      payload: {
        serverId: server.id,
        expectedConfigRevision: model.configRevision,
        scope: writableScope(server.sourceScope),
      },
    }, () => {
      this.removeConfirmId = null;
      this.props.onNavigatePlugin();
    }));
  }

  private renderCredentialSelector(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    server: FrontendMcpServerViewModel,
  ): void {
    const section = createPageSection(parent, {
      title: "Authentication",
      description: "Choose a secret stored by Obsidian. Chatobby saves only its reference in the plugin configuration.",
      surface: "divided",
    });
    const field = section.content.createDiv({ cls: "chatobby-mcp__field" });
    field.createSpan({ text: "Access token" });
    new SecretComponent(this.props.app, field)
      .setValue(server.credentialReference ?? "")
      .onChange((reference) => {
        if (!reference || reference === server.credentialReference) return;
        void this.runIntent({
          type: "mcp.set-credential-reference",
          payload: {
            expectedConfigRevision: model.configRevision,
            serverId: server.id,
            reference,
            scope: server.writable ? writableScope(server.sourceScope) : undefined,
          },
        });
      });
  }

  private renderEditor(parent: HTMLElement, model: FrontendPluginMcpScreenViewModel): void {
    const section = createPageSection(parent, {
      title: "Add custom MCP plugin",
      description: "Register a remote endpoint or local program. It is saved disabled until you review it.",
      surface: "inset",
    });
    const form = section.content.createDiv({ cls: "chatobby-mcp__editor" });
    const name = inputField(form, "Name", "mcp:new:name", "my-plugin");
    const scope = selectField(form, "Available in", "mcp:new:scope", [
      ["project", "This project"],
      ["user", "All projects"],
    ]);
    const transport = selectField(form, "Connection", "mcp:new:transport", [
      ["remote", "Remote URL"],
      ["local", "Local program"],
    ]);
    const lifecycle = selectField(form, "Start plugin", "mcp:new:lifecycle", [
      ["lazy", "When a tool is used"],
      ["keep-alive", "Keep it running"],
      ["eager", "When Chatobby starts"],
    ]);
    const url = inputField(form, "Server URL", "mcp:new:url", "https://example.com/mcp");
    const authentication = selectField(form, "Sign-in method", "mcp:new:auth", [
      ["oauth", "Browser sign-in"],
      ["bearer", "Token stored by Obsidian"],
      ["none", "No sign-in"],
    ]);
    const bearerField = form.createDiv({ cls: "chatobby-mcp__field" });
    bearerField.createSpan({ text: "Access token" });
    let bearerCredentialReference = "";
    new SecretComponent(this.props.app, bearerField).onChange((reference) => {
      bearerCredentialReference = reference;
    });
    const command = inputField(form, "Program", "mcp:new:command", "npx");
    const argumentsInput = textAreaField(form, "Arguments, one per line", "mcp:new:arguments");
    const workingDirectory = inputField(form, "Working folder (optional)", "mcp:new:cwd", "");
    const environment = textAreaField(form, "Environment mappings, NAME=ENV_VARIABLE", "mcp:new:environment");
    const headers = textAreaField(form, "Header mappings, HEADER=ENV_VARIABLE", "mcp:new:headers");
    const refreshTransport = (): void => {
      const remote = transport.value === "remote";
      url.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", !remote);
      authentication.closest<HTMLElement>(".chatobby-mcp__field")?.toggleClass("is-hidden", !remote);
      bearerField.toggleClass(
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
      bearerCredentialReference: bearerCredentialReference || undefined,
      environment: mappings(environment.value),
      headers: mappings(headers.value),
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
      description: "Open the sign-in page, then paste the returned code or redirect URL.",
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
    const input = inputField(section.content, "Code or redirect URL", `mcp:auth:${pending.serverId}`, "");
    const actions = createPageActionRow(section.content);
    const complete = actions.createEl("button", {
      cls: "mod-cta",
      text: "Complete sign-in",
      attr: { type: "button" },
    });
    complete.addEventListener("click", () => void this.runIntent({
      type: "mcp.auth-complete",
      payload: { serverId: pending.serverId, input: input.value.trim() },
    }));
  }

  private filteredPlugins(
    plugins: readonly FrontendChatobbyPluginSummary[],
    query: string,
  ): readonly FrontendChatobbyPluginSummary[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = plugins.filter((plugin) => {
      if (this.sourceFilter !== "all" && plugin.source !== this.sourceFilter) return false;
      if (this.connectionFilter !== "all" && plugin.transport !== this.connectionFilter) return false;
      if (!normalizedQuery) return true;
      return `${plugin.title} ${plugin.description} ${plugin.publisher} ${plugin.sourceLabel}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
    if (this.sort === "name") return [...filtered].sort((left, right) => left.title.localeCompare(right.title));
    if (this.sort === "updated") {
      return [...filtered].sort((left, right) => {
        const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : Number.NEGATIVE_INFINITY;
        const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : Number.NEGATIVE_INFINITY;
        return rightTime - leftTime || left.title.localeCompare(right.title);
      });
    }
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
      const cancelledServerId =
        intent.type === "mcp.connect" || intent.type === "mcp.discover"
          ? intent.payload.serverId
          : undefined;
      if (!cancelledServerId || !this.cancelledServerIds.has(cancelledServerId)) {
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
      await this.props.onIntent({ type: "mcp.disconnect", payload: { serverId } });
      this.localError = null;
    } catch (error) {
      this.cancelledServerIds.delete(serverId);
      this.localError = errorMessage(error);
    }
    this.renderState(this.props.getModel());
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
  selectOptions(select, options);
  return select;
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

function isSourceFilter(value: string): value is PluginSourceFilter {
  return value === "all"
    || value === "built-in"
    || value === "reference"
    || value === "first-party"
    || value === "community"
    || value === "custom";
}

function isConnectionFilter(value: string): value is PluginConnectionFilter {
  return value === "all" || value === "remote" || value === "local";
}

function isPluginSort(value: string): value is PluginSort {
  return value === "relevance" || value === "name" || value === "updated";
}

function writableScope(scope: FrontendMcpServerViewModel["sourceScope"]): "user" | "project" {
  return scope === "project" ? "project" : "user";
}

function pluginSubtitle(plugin: FrontendChatobbyPluginDetail): string {
  return [plugin.publisher, plugin.version, plugin.sourceLabel].filter(Boolean).join(" · ");
}

function pluginIcon(plugin: FrontendChatobbyPluginSummary): string {
  if (plugin.id === "chatobby:local-skills") return "sparkles";
  if (plugin.source === "built-in") return "box";
  if (plugin.source === "reference") return "flask-conical";
  if (plugin.transport === "remote") return "cloud";
  return "plug";
}

function capabilityIcon(kind: FrontendChatobbyPluginCapability["kind"]): string {
  if (kind === "skill") return "sparkles";
  if (kind === "command") return "terminal";
  if (kind === "workflow") return "workflow";
  if (kind === "context-query") return "braces";
  return "plug";
}

function capabilityCountLabel(plugin: FrontendChatobbyPluginSummary): string {
  const counts = plugin.capabilityCounts;
  const values = [
    counts.mcpServers > 0 ? `${counts.mcpServers} ${counts.mcpServers === 1 ? "server" : "servers"}` : "",
    counts.skills > 0 ? `${counts.skills} ${counts.skills === 1 ? "skill" : "skills"}` : "",
    counts.commands > 0 ? `${counts.commands} ${counts.commands === 1 ? "command" : "commands"}` : "",
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
    `${counts.contextQueries} context queries`,
  ].join(", ");
}

function safeExternalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
