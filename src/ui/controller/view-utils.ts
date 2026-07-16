import { normalizePath } from "obsidian";
import type { InteractionState, ThinkingLevel, WsExtensionUIRequest } from "../../types";
import { createFeedStore, type FeedStore } from "../../features/feed/public";
import { normalizeVaultDirectoryInput } from "../session/session-directory";
import type { SlashArgumentOption } from "../composer/slash-command";

/** Returns whether an extension request requires an inline response card. */
export function isBlockingInteraction(method: WsExtensionUIRequest["method"]): method is InteractionState["method"] {
  return method === "select" || method === "confirm" || method === "input" || method === "editor";
}

/** Creates the local presentation store populated by runtime feed projections. */
export function createProjectedFeedStore(): FeedStore {
  return createFeedStore();
}

/** Rejects with a descriptive error if a backend operation does not start in time. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} within ${timeoutMs / 1000}s`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Narrows a string to a backend-supported thinking level. */
export function isThinkingLevel(value: string): value is ThinkingLevel {
  return value === "off" || value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh";
}

/** Builds autocomplete choices for the supported thinking levels. */
export function thinkingArgumentOptions(): SlashArgumentOption[] {
  return ["off", "minimal", "low", "medium", "high", "xhigh"].map((level) => ({
    value: level,
    label: labelThinking(level),
  }));
}

/** Converts a provider identifier to a compact UI label. */
export function labelProvider(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Converts a thinking-level identifier to a compact UI label. */
export function labelThinking(level: string): string {
  if (level === "xhigh") return "X-High";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Formats the selected vault directory for tab and notice copy. */
export function workingDirectoryLabel(vaultDirectoryPath: string, vaultName: string): string {
  const normalized = normalizeVaultDirectoryInput(vaultDirectoryPath);
  return normalized ? `/${normalized}` : `${vaultName.trim() || "Vault"} /`;
}

/** Maps extension notification severity onto the feed panel contract. */
export function extensionPanelLevel(value: unknown): "info" | "warning" | "error" {
  return value === "warning" || value === "error" ? value : "info";
}

/** Filters redundant transport notices that already have first-class UI. */
export function shouldSuppressExtensionNotice(message: string): boolean {
  return /^MCP:\s*\d+\s+servers?\s+connected\b/i.test(message.trim());
}

/** Produces a stable heading for an extension notice panel. */
export function extensionNoticeTitle(message: string, level: "info" | "warning" | "error"): string {
  const lower = message.toLowerCase();
  if (lower.includes("memory")) return "Memory";
  if (lower.includes("permission-system") || lower.includes("permission system")) return "Permissions";
  if (lower.includes("subagent")) return "Subagents";
  if (level === "error") return "Extension Error";
  if (level === "warning") return "Extension Warning";
  return "Extension Notice";
}

/** Identifies the extension that emitted a known notice. */
export function extensionNoticeSource(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("memory")) return "memory-service";
  if (lower.includes("permission-system") || lower.includes("permission system")) return "permission-system";
  if (lower.includes("subagent")) return "@chatobby/pi-subagents";
  return undefined;
}

/** Converts a machine identifier to title case. */
export function titleCase(value: string): string {
  return value.split(/[-_: ]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

/** Resolves the canonical project-scoped permission-system configuration path. */
export function permissionProjectConfigPath(vaultDirectoryPath: string): string {
  return normalizePath(`${permissionProjectRoot(vaultDirectoryPath)}/.chatobby/agent/extensions/permission-system/config.json`);
}

/** Returns recognized legacy permission-system paths for one-time migration. */
export function legacyPermissionProjectConfigPaths(vaultDirectoryPath: string): string[] {
  const root = permissionProjectRoot(vaultDirectoryPath);
  return [
    normalizePath(`${root}/.chatobby/agent/extensions/pi-permission-system/config.json`),
    normalizePath(`${root}/.chatobby/extensions/pi-permission-system/config.json`),
  ];
}

/** Formats a millisecond duration for compact feed metadata. */
export function formatDurationLabel(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 100) / 10)}s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function permissionProjectRoot(vaultDirectoryPath: string): string {
  return normalizeVaultDirectoryInput(vaultDirectoryPath) || ".";
}
