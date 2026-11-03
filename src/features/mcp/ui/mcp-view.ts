import { setIcon, type App } from "obsidian";
import type {
  FrontendIntent,
  FrontendMcpServerViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type {
  FrontendChatobbyPluginDetail,
  FrontendPluginMcpScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-plugin-contracts";
import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageIconButton,
  createPageState,
  PageShell,
} from "../../../ui/shared/page-shell";
import {
  renderPluginList,
  type PluginConnectionFilter,
  type PluginSort,
} from "./catalogue/plugin-list";
import { pluginSubtitle } from "./plugin-summary";
import { renderPluginDetail, type PluginDetailOptions } from "./detail/plugin-detail";
import { renderPendingAuthentication, type ServerOperation } from "./detail/server-controls";
import { renderConnectionEditor } from "./editor/connection-editor";

type CanonicalMcpIntent = Extract<FrontendIntent, { type: `mcp.${string}` }>;
/** Distribute before picking, so each canonical action retains its own payload. */
export type McpViewIntent = CanonicalMcpIntent extends infer Intent
  ? Intent extends CanonicalMcpIntent
    ? Pick<Intent, "type" | "payload">
    : never
  : never;

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

const SEARCH_DEBOUNCE_MS = 300;

export class McpView extends ChatobbyComponent {
  private readonly props: McpViewProps;
  private unsubscribe: (() => void) | null = null;
  private shell: PageShell | null = null;
  private backButton: HTMLButtonElement | null = null;
  private addButton: HTMLButtonElement | null = null;
  private refreshButton: HTMLButtonElement | null = null;
  private pluginId: string | undefined;
  private editorSession: { readonly seed: FrontendMcpServerViewModel | null } | null = null;
  private formPresentations: ((focusKey?: string) => void)[] = [];
  private captureEditorFocus: (() => string | undefined) | null = null;
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
      this.editorSession = { seed: null };
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
    this.editorSession = null;
    this.formPresentations = [];
    this.captureEditorFocus = null;
    this.shell = null;
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
    this.editorSession = null;
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
    } else if (this.editorSession) {
      this.editorSession = null;
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
    const focusedField = this.captureEditorFocus?.();
    this.captureEditorFocus = null;
    this.formPresentations = [];
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
          if (this.editorSession?.seed)
            this.renderEditor(body, model);
          else this.renderPluginDetail(body, model, detail);
        }
      });
      for (const refresh of this.formPresentations) refresh(focusedField);
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
      if (model.selectedTab === "installed" && this.editorSession)
        this.renderEditor(body, model);
      this.renderCatalogue(body, model);
    });
    for (const refresh of this.formPresentations) refresh(focusedField);
    if (this.restoreListScroll && model) {
      shell.body.scrollTop = this.listScroll.get(model.selectedTab) ?? 0;
      this.restoreListScroll = false;
    }
  }

  private renderCatalogue(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
  ): void {
    renderPluginList(parent, model, {
      installedQuery: this.installedQuery,
      connectionFilter: this.connectionFilter,
      sort: this.sort,
    }, {
      onSearchInput: (query, currentQuery) => {
        if (model.selectedTab === "discover") {
          this.scheduleSearch(query.trim(), currentQuery);
        } else {
          this.installedQuery = query;
          this.renderState(this.props.getModel());
        }
      },
      onSearchSubmit: (query) => {
        this.cancelScheduledSearch();
        void this.changeView("discover", query);
      },
      onConnectionChange: (value) => {
        this.connectionFilter = value;
        this.renderState(this.props.getModel());
      },
      onSortChange: (value) => {
        this.sort = value;
        this.renderState(this.props.getModel());
      },
      onSelect: (pluginId) => this.props.onNavigatePlugin(pluginId),
    });
  }

  private renderPluginDetail(
    parent: HTMLElement,
    model: FrontendPluginMcpScreenViewModel,
    plugin: FrontendChatobbyPluginDetail,
  ): void {
    const refresh = renderPluginDetail(parent, plugin, this.detailOptions(model));
    if (refresh) this.formPresentations.push(refresh);
  }

  private detailOptions(model: FrontendPluginMcpScreenViewModel): PluginDetailOptions {
    return {
      app: this.props.app,
      busy: this.busy,
      removeConfirmId: this.removeConfirmId,
      onConfigureVerified: (pluginId) => void this.runIntent({
        type: "mcp.configure-verified",
        payload: { expectedConfigRevision: model.configRevision, pluginId, scope: "user" },
      }),
      actions: {
        onOperation: (operation, serverId) => this.simpleIntent(operation, serverId),
        onCancelOperation: (serverId) => void this.cancelServerOperation(serverId),
        onReviewSuggestion: (server) => {
          this.editorSession = { seed: server };
          this.renderState(this.props.getModel());
        },
        onSetEnabled: (server, enabled) => void this.runIntent({
          type: "mcp.set-enabled",
          payload: {
            expectedConfigRevision: model.configRevision,
            serverId: server.id,
            enabled,
            scope: server.writable ? "user" : undefined,
          },
        }),
        onRemoveConfirmation: (serverId) => {
          this.removeConfirmId = serverId;
          this.renderState(this.props.getModel());
        },
        onRemove: (server) => void this.runIntent({
          type: "mcp.remove",
          payload: {
            expectedConfigRevision: model.configRevision,
            serverId: server.id,
            scope: "user",
          },
        }, () => {
          this.removeConfirmId = null;
          this.props.onNavigatePlugin();
        }),
        onSetToolEnabled: (server, toolName, enabled) => void this.runIntent({
          type: "mcp.set-tool-enabled",
          payload: {
            expectedConfigRevision: model.configRevision,
            serverId: server.id,
            toolName,
            enabled,
            scope: server.writable ? "user" : undefined,
          },
        }),
        onSetCredential: (server, reference) => void this.runIntent({
          type: "mcp.set-credential-reference",
          payload: {
            expectedConfigRevision: model.configRevision,
            serverId: server.id,
            reference,
            scope: server.writable ? "user" : undefined,
          },
        }),
      },
    };
  }

  private renderEditor(parent: HTMLElement, model: FrontendPluginMcpScreenViewModel): void {
    const session = this.editorSession;
    if (!session) return;
    const presentation = renderConnectionEditor(parent, {
      app: this.props.app,
      seed: session.seed,
      onBrowseVerified: () => {
        if (this.editorSession === session) void this.changeView("discover", "");
      },
      onCancel: () => {
        if (this.editorSession !== session) return;
        this.editorSession = null;
        this.renderState(this.props.getModel());
      },
      onPreview: (draft) => {
        if (this.editorSession !== session) return;
        void this.runIntent({ type: "mcp.preview", payload: { draft } }, undefined,
          () => this.editorSession === session);
      },
      onSave: (draft) => {
        if (this.editorSession !== session) return;
        void this.runIntent({
          type: "mcp.save",
          payload: { expectedConfigRevision: model.configRevision, draft },
        }, () => {
          // A completed runtime save must not close a newer local editor.
          this.editorSession = null;
        }, () => this.editorSession === session);
      },
    });
    this.captureEditorFocus = () => this.editorSession === session ? presentation.focusedField() : undefined;
    this.formPresentations.push((focusKey) => {
      if (this.editorSession === session) presentation.refreshPresentation(focusKey);
    });
  }

  private renderAuthentication(parent: HTMLElement, model: FrontendPluginMcpScreenViewModel): void {
    if (!model.pendingAuthentication) return;
    renderPendingAuthentication(parent, model.pendingAuthentication, (serverId, input) => {
      void this.runIntent({ type: "mcp.auth-complete", payload: { serverId, input } });
    });
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
    type: ServerOperation,
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
    isCurrent: () => boolean = () => this.isMounted,
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onIntent(intent);
      if (isCurrent()) onSuccess?.();
    } catch (error) {
      const cancelledServerId =
        intent.type === "mcp.connect" || intent.type === "mcp.discover"
          ? intent.payload.serverId
          : undefined;
      if (
        isCurrent() && (!cancelledServerId ||
        !this.cancelledServerIds.has(cancelledServerId))
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
