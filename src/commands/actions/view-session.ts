// View + session + transport commands. Each delegates to the active ChatobbyView
// via services.withView (which opens the view first). The reload-extensions
// command talks to the transport directly (no view needed).

import type { ChatobbyAction } from "../registry";

/** Session lifecycle + messaging. */
const sessionActions: ChatobbyAction[] = [
  { id: "new-session", name: "New session", group: "session", run: (s) => s.withView((v) => v.commandNewSession()) },
  { id: "resume-session", name: "Resume session", group: "session", run: (s) => s.withView((v) => v.commandResumeSession()) },
  { id: "set-working-directory", name: "Set working directory", group: "session", run: (s) => s.withView((v) => v.commandSetWorkingDirectory()) },
  { id: "send-prompt", name: "Send prompt", group: "session", run: (s) => s.withView((v) => v.commandSendPrompt()) },
  { id: "abort", name: "Stop generation", group: "session", run: (s) => s.withView((v) => v.commandAbort()) },
  { id: "compact", name: "Compact context", group: "session", run: (s) => s.withView((v) => v.commandCompact()) },
  { id: "rename-session", name: "Rename session", group: "session", palette: false, run: (s) => s.withView((v) => v.commandRenameSession()) },
  { id: "clone-session", name: "Clone session", group: "session", palette: false, run: (s) => s.withView((v) => v.commandClone()) },
  { id: "fork", name: "Fork from a conversation point", group: "session", palette: false, run: (s) => s.withView((v) => v.commandFork()) },
  { id: "import-jsonl", name: "Import session from JSONL", group: "session", palette: false, run: (s) => s.withView((v) => v.commandImportJsonl()) },
  { id: "toggle-auto-compaction", name: "Toggle auto-compaction", group: "session", palette: false, run: (s) => s.withView((v) => v.commandToggleAutoCompaction()) },
];

/** Export / capture. */
const captureActions: ChatobbyAction[] = [
  { id: "export-html", name: "Export session as HTML", group: "capture", palette: false, run: (s) => s.withView((v) => { void v.commandExportHtml(); }) },
  { id: "export-jsonl", name: "Export session as JSONL", group: "capture", palette: false, run: (s) => s.withView((v) => { void v.commandExportJsonl(); }) },
  { id: "copy-last-response", name: "Copy last response", group: "capture", run: (s) => s.withView((v) => { void v.commandCopyLastResponse(); }) },
];

/** Direct agent actions. */
const directActions: ChatobbyAction[] = [
  { id: "bash", name: "Run bash command (into agent context)", group: "action", palette: false, run: (s) => s.withView((v) => { void v.commandBash(); }) },
  { id: "queue-follow-up", name: "Queue follow-up message", group: "action", palette: false, run: (s) => s.withView((v) => { void v.commandQueueFollowUp(); }) },
];

/** Transport: hot-reload extensions/skills/prompts. */
const transportActions: ChatobbyAction[] = [
  {
    id: "reload",
    name: "Reload extensions",
    group: "transport",
    palette: false,
    run: (s) => s.withView((view) => view.commandReload()),
  },
];

export const viewSessionActions: ChatobbyAction[] = [
  ...sessionActions,
  ...captureActions,
  ...directActions,
  ...transportActions,
];
