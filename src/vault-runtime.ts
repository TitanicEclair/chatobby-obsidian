import type { App } from "obsidian";
import { join } from "node:path";
import { getVaultBasePath } from "./ui/session/session-directory";

export interface ChatobbyVaultRuntimePaths {
  vaultRoot: string;
  chatobbyRoot: string;
  agentDir: string;
  attachmentDir: string;
}

export function getChatobbyVaultRuntimePaths(app: App): ChatobbyVaultRuntimePaths | null {
  const vaultRoot = getVaultBasePath(app);
  if (!vaultRoot) return null;
  const chatobbyRoot = join(vaultRoot, ".chatobby");
  return {
    vaultRoot,
    chatobbyRoot,
    agentDir: join(chatobbyRoot, "agent"),
    attachmentDir: join(chatobbyRoot, "attachments"),
  };
}

export function hasAgentDirArg(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--agent-dir" || arg.startsWith("--agent-dir="));
}
