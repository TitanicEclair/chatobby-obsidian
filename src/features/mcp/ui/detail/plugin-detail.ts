import { setIcon } from "obsidian";
import type { FrontendChatobbyPluginCapability, FrontendChatobbyPluginDetail } from "../../../../vendor/chatobby-client/frontend-plugin-contracts";
import { createPageActionRow, createPageSection } from "../../../../ui/shared/page-shell";
import { renderPluginIdentity } from "../plugin-summary";
import { renderExternalLink } from "../links";
import { renderServerControls, type ServerControlOptions } from "./server-controls";

export interface PluginDetailOptions extends ServerControlOptions {
  readonly onConfigureVerified: (pluginId: string) => void;
}

export function renderPluginDetail(
  parent: HTMLElement,
  plugin: FrontendChatobbyPluginDetail,
  options: PluginDetailOptions,
): (() => void) | undefined {
  const overview = createPageSection(parent, {
    description: plugin.description,
    className: "chatobby-mcp__plugin-overview",
  });
  renderPluginIdentity(overview.content, plugin);
  const actions = createPageActionRow(
    overview.content,
    "chatobby-mcp__detail-actions",
  );
  renderExternalLink(actions, "View source", plugin.repositoryUrl);
  if (plugin.catalog?.canConfigure && !plugin.installed) {
    const catalog = plugin.catalog;
    const install = actions.createEl("button", {
      cls: "mod-cta",
      text: "Add disabled",
      attr: { type: "button" },
    });
    install.disabled = options.busy;
    install.addEventListener("click", () => options.onConfigureVerified(catalog.name));
  }
  const refresh = plugin.server ? renderServerControls(overview.content, parent, plugin.server, options) : undefined;

  const otherCapabilities = plugin.capabilities.filter(
    (capability) =>
      capability.kind !== "mcp-tool" && capability.kind !== "mcp-resource",
  );
  if (otherCapabilities.length > 0)
    renderCapabilities(parent, otherCapabilities);
  if (plugin.setup.length > 0)
    renderDefinitionSection(parent, "Setup", plugin.setup);
  if (plugin.permissions.length > 0) {
    renderTextList(
      parent,
      "Access notes",
      "Access used by this connection and its account.",
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
      if (!renderExternalLink(value, metric.value.toLocaleString(), metric.sourceUrl)) {
        value.textContent = metric.value.toLocaleString();
      }
      row.createSpan({
        cls: "chatobby-mcp__metric-period",
        text: metric.period,
      });
    }
  }
  if (plugin.cautions.length > 0) {
    renderTextList(
      parent,
      "Before enabling",
      undefined,
      plugin.cautions,
      "warning",
    );
  }
  return refresh;
}

function renderCapabilities(
  parent: HTMLElement,
  capabilities: readonly FrontendChatobbyPluginCapability[],
): void {
  const section = createPageSection(parent, {
    title: "Capabilities",
    description:
      "Capabilities reported by this connection. Choose which tools the agent can use.",
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

function renderDefinitionSection(
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

function renderTextList(
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

function detail(parent: HTMLElement, label: string, value: string): void {
  parent.createEl("dt", { text: label });
  parent.createEl("dd", { text: value || "Not set" });
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
