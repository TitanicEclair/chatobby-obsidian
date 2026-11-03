import type { FrontendChatobbyPluginSummary, FrontendPluginMcpScreenViewModel } from "../../../../vendor/chatobby-client/frontend-plugin-contracts";
import { createPageSection, createPageState, createPageToolbar } from "../../../../ui/shared/page-shell";
import { selectOptions } from "../controls/form-fields";
import { renderPluginRow } from "../plugin-summary";

export type PluginConnectionFilter = "all" | "remote" | "local";
export type PluginSort = "relevance" | "name";
export interface PluginListState {
  readonly installedQuery: string;
  readonly connectionFilter: PluginConnectionFilter;
  readonly sort: PluginSort;
}
interface PluginListActions {
  readonly onSearchInput: (query: string, currentQuery: string) => void;
  readonly onSearchSubmit: (query: string) => void;
  readonly onConnectionChange: (value: PluginConnectionFilter) => void;
  readonly onSortChange: (value: PluginSort) => void;
  readonly onSelect: (pluginId: string) => void;
}

export function renderPluginList(
  parent: HTMLElement,
  model: FrontendPluginMcpScreenViewModel,
  state: PluginListState,
  actions: PluginListActions,
): void {
  if (model.selectedTab === "discover") renderDiscover(parent, model, state, actions);
  else renderInstalled(parent, model, state, actions);
}

function renderInstalled(
  parent: HTMLElement,
  model: FrontendPluginMcpScreenViewModel,
  state: PluginListState,
  actions: PluginListActions,
): void {
  const plugins = filterPlugins(
    model.installedPlugins,
    state.installedQuery,
    state,
  );
  renderFilterBar(
    parent,
    model,
    "installed",
    plugins.length,
    model.installedPlugins.length,
    state,
    actions,
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
  renderPluginGroup(
    parent,
    "Chatobby",
    "Capabilities included with Chatobby and local skills available to this session.",
    chatobby,
    actions.onSelect,
  );
  renderPluginGroup(
    parent,
    "Verified connections",
    "Connection definitions reviewed and shipped by Chatobby.",
    verified,
    actions.onSelect,
  );
  renderPluginGroup(
    parent,
    "Manual connections",
    "Connections from this project or your user configuration. Open one to inspect its reported identity, tools, and source.",
    manual,
    actions.onSelect,
  );
}

function renderPluginGroup(
  parent: HTMLElement,
  title: string,
  description: string,
  plugins: readonly FrontendChatobbyPluginSummary[],
  onSelect: (pluginId: string) => void,
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
  for (const plugin of plugins) renderPluginRow(list, plugin, onSelect);
}

function renderDiscover(
  parent: HTMLElement,
  model: FrontendPluginMcpScreenViewModel,
  state: PluginListState,
  actions: PluginListActions,
): void {
  const plugins = filterPlugins(model.catalogPlugins, model.query, state);
  renderFilterBar(
    parent,
    model,
    "discover",
    plugins.length,
    model.catalogPlugins.length,
    state,
    actions,
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
    for (const plugin of plugins) renderPluginRow(list, plugin, actions.onSelect);
  }
  const meta = parent.createDiv({ cls: "chatobby-mcp__coverage" });
  meta.createSpan({
    text: `${model.catalogPlugins.length} verified ${model.catalogPlugins.length === 1 ? "plugin" : "plugins"} in this Chatobby release`,
  });
}

function renderFilterBar(
  parent: HTMLElement,
  model: FrontendPluginMcpScreenViewModel,
  tab: "installed" | "discover",
  matches: number,
  indexed: number,
  state: PluginListState,
  actions: PluginListActions,
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
  search.value = tab === "discover" ? model.query : state.installedQuery;
  if (tab === "discover") {
    search.addEventListener("input", () =>
      actions.onSearchInput(search.value, model.query),
    );
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      actions.onSearchSubmit(search.value.trim());
    });
  } else {
    search.addEventListener("input", () => {
      actions.onSearchInput(search.value, model.query);
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
  connection.value = state.connectionFilter;
  connection.addEventListener("change", () => {
    actions.onConnectionChange(isConnectionFilter(connection.value) ? connection.value : "all");
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
  sort.value = state.sort;
  sort.addEventListener("change", () => {
    actions.onSortChange(isPluginSort(sort.value) ? sort.value : "relevance");
  });
  toolbar.createDiv({
    cls: "chatobby-mcp__result-count",
    text:
      matches < indexed
        ? `${matches} ${matches === 1 ? "match" : "matches"}`
        : `${matches} shown`,
    attr: { "aria-live": "polite" },
  });
}

function filterPlugins(
  plugins: readonly FrontendChatobbyPluginSummary[],
  query: string,
  state: PluginListState,
): readonly FrontendChatobbyPluginSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = plugins.filter((plugin) => {
    if (
      state.connectionFilter !== "all" &&
      plugin.transport !== state.connectionFilter
    )
      return false;
    if (!normalizedQuery) return true;
    return `${plugin.title} ${plugin.description} ${plugin.publisher} ${plugin.sourceLabel}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  if (state.sort === "name")
    return [...filtered].sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  return filtered;
}

function isConnectionFilter(value: string): value is PluginConnectionFilter {
  return value === "all" || value === "remote" || value === "local";
}

function isPluginSort(value: string): value is PluginSort {
  return value === "relevance" || value === "name";
}
