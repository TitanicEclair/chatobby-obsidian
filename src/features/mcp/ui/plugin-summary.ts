import { setIcon } from "obsidian";
import type { FrontendChatobbyPluginSummary, FrontendChatobbyPluginDetail } from "../../../vendor/chatobby-client/frontend-plugin-contracts";
import { renderPluginBrandIcon } from "./plugin-brand-icon";

export function renderPluginRow(
  parent: HTMLElement,
  plugin: FrontendChatobbyPluginSummary,
  onSelect: (pluginId: string) => void,
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
    text: pluginMetadata(plugin).join(" · "),
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
  row.addEventListener("click", () => onSelect(plugin.id));
}

export function renderPluginIdentity(
  parent: HTMLElement,
  plugin: FrontendChatobbyPluginSummary,
): void {
  if (plugin.verifiedPublisher && plugin.brandIcon) {
    const identity = parent.createDiv({
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
  const metadata = parent.createDiv({
    cls: "chatobby-mcp__detail-meta",
  });
  for (const value of pluginMetadata(plugin)) {
    metadata.createSpan({ text: value });
  }
}

function pluginMetadata(plugin: FrontendChatobbyPluginSummary): readonly string[] {
  return [plugin.publisher, plugin.sourceLabel, plugin.transportLabel, plugin.version]
    .filter((value): value is string => Boolean(value));
}

export function pluginSubtitle(plugin: FrontendChatobbyPluginDetail): string {
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
