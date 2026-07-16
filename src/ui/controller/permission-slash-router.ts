import type { SlashParsedCommand } from "../composer/slash-command";

export interface PermissionSlashRoutes {
  openPermissions(): void;
  sendRawPrompt(text: string): Promise<void>;
  renderFeedback(input: string, guidance: string): void;
}

/** Route the compatibility `/permissions` argument surface to UI or backend ownership. */
export async function routePermissionSlash(
  parsed: SlashParsedCommand,
  routes: PermissionSlashRoutes,
): Promise<void> {
  const argument = parsed.args[0]?.trim();
  if (!argument || ["edit", "guided", "configure", "json", "edit-json"].includes(argument)) {
    routes.openPermissions();
    return;
  }
  if (["show", "path", "reset", "help"].includes(argument)) {
    await routes.sendRawPrompt(parsed.raw);
    return;
  }
  routes.renderFeedback(
    parsed.raw,
    "Use `/permissions`, `/permissions json`, or one of: show, path, reset, help.",
  );
}
