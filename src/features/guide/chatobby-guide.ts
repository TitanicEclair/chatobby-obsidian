import { type App, normalizePath, Notice, TFile } from "obsidian";
import { confirmAction } from "../../ui/modals/modals";

/** Filename used when the runtime does not supply one. */
export const CHATOBBY_GUIDE_FILENAME = "Chatobby Guide.md";

/**
 * Bundled static guide used as the offline fallback when the runtime's
 * `get_guide` command is unavailable. Kept in sync with the runtime-owned guide
 * (packages/chatobby/src/guide-content.ts) so connected and offline clients see
 * the same content.
 */
export const CHATOBBY_GUIDE_MARKDOWN = `# Chatobby Guide

> [!note] Early guide
> Chatobby is still in active development. This guide does not yet cover every feature or include visual walkthroughs.

Chatobby is a local agent interface for Obsidian. It can discuss your notes, use approved tools, work across longer tasks, and connect to optional services. You choose the model provider and permission policy.

## Start a chat

1. Open Chatobby from the Obsidian ribbon or command palette.
2. Choose the folder that should define the session's project.
3. Choose a provider, model, effort level, and permission policy below the composer.
4. Send a clear request. Include the outcome you want and any limits that matter.

Each Obsidian tab holds one Chatobby session. Opening another project or starting another session creates another Chatobby view instead of silently changing an existing session's meaning.

## Working with your vault

Ask Chatobby to find, read, create, revise, or organize notes. Name a folder when the work should stay within one area. For changes involving links, frontmatter, plugin blocks, or other Obsidian-specific behavior, ask it to verify the result in Obsidian.

Chatobby can use project instructions from a \`.chatobby.md\` file. Keep this file in the project folder when you want durable guidance that applies to work in that project. Standard \`AGENTS.md\` instructions can also apply to coding work.

## Permissions

A permission policy controls what an agent may do without interrupting you.

- **Allow** lets the action proceed.
- **Ask** requires confirmation.
- **Deny** prevents the action.

Policies can be reused and assigned to the main agent, subagents, and events. Connected MCP services appear as separate sections after their tools are discovered. Their tools begin denied in each policy until you explicitly allow them. When you change the active policy, Chatobby rebuilds the visible tool set immediately and blocks actions that are no longer allowed, whether the agent calls a tool directly or through the generic connection.

Use a restrictive policy for unfamiliar or sensitive work. Grant only the capabilities a task needs. A policy changes access; it does not connect a service or add credentials.

## Memory

Tell Chatobby directly when something should be remembered. Suggestions may also appear in the conversation for you to approve or dismiss.

Memory has several scopes:

- **Vault profile** stores durable preferences about how you like to work.
- **Vault memory** stores facts and conventions shared across the vault.
- **Project memory** follows the selected project hierarchy. Parent projects never read child-project memory. A child project can also isolate all of its own memory so nothing leaks in or out.
- **Lessons and corrections** preserve useful failures or corrected behavior.

The Memory page lets you search, filter, sort, edit, archive, and delete records. A project can inherit vault and parent memory, exclude parent projects, or use only its own memory.

Use project instructions rather than memory for rules that must always be followed exactly. Use memory for durable facts, preferences, and lessons that should be retrieved when relevant.

## Subagents and tasks

Subagents are supervised workers for bounded parallel or specialist work. The agent rail switches between the main session and its subagent feeds. A subagent can use its assigned role, model, tools, and permission policy.

Ask for subagents when work can be split into clear independent outcomes. Give each worker a narrow objective and a stopping condition. The task strip above the composer shows the current plan while work is active.

## Channels

Channels hold durable agent-to-agent messages. Messages show who sent them, who they address, and the related session or directory when available.

Use channels when agents need to exchange results or dependencies. Use the Channels page to review the conversation later; agents do not need to poll continuously to receive a live addressed message.

## Events

Events schedule Chatobby work. An event has instructions, a project, an agent, a permission policy, timing, repetition rules, runtime limits, and daily run limits.

When an event runs, it creates a normal reviewable session. Use Events for work that should happen later or repeat. Test an event manually before relying on a recurring schedule.

## Context queries

Context queries are small project-owned scripts that compute structured information at session start or before each turn. They live under the project's \`.chatobby/queries/scripts/\` folder and are managed from the Queries page.

Create and test a query while it is disabled. Review its result, then enable it only when you trust the code and the amount of context it adds. Prefer concise structured output.

## MCP services and plugins

MCP services connect Chatobby to additional tools such as repositories, communication apps, or data services. Use the MCP page to explore available connections, add a custom server, review setup requirements, connect, update, disconnect, or remove it.

Installing or configuring a service does not automatically grant its tools. After connection, review its section on the Permissions page and allow only what you need. Some services require an account sign-in, environment variable, or provider-specific credential (for example, a GitHub personal access token, which Chatobby stores in Obsidian's secure secret storage and never writes to plain config files).

## Models and providers

Chatobby uses your own provider account or API key. Open Chatobby settings to add or update providers. You normally do not need to edit configuration files.

The provider, model, and effort controls below the composer apply to the current session. Changing provider should select a compatible model. Availability, pricing, context limits, and data handling come from the provider you choose.

## Built-in guidance and safety

Chatobby combines built-in operating and safety guidance (the system prompt) with the current environment, permission policy, project instructions, loaded skills, and relevant memory. Built-in safety requirements cannot be replaced by a vault note or user message.

Treat connected services, downloaded content, and unfamiliar scripts as untrusted until reviewed. Chatobby cannot guarantee that third-party tools, models, or information are correct or available.

## If something goes wrong

1. Stop the active turn if it is still running.
2. Open runtime details and copy diagnostics.
3. Check whether the selected provider and permission policy fit the task.
4. Reconnect or update Chatobby from the in-plugin runtime controls if prompted.
5. Report reproducible bugs through the Chatobby issue tracker and include redacted diagnostics.

Do not share API keys, access tokens, full private prompts, or unrelated vault contents in a public report.
`;

/** Shape of the runtime-owned guide payload (`get_guide` response). */
export interface GuideContent {
  content: string;
  path: string;
  title: string;
  version: string;
  earlyAccess: boolean;
  confirmationNotice: string;
}

export interface DownloadChatobbyGuideOptions {
  app: App;
  /** Returns the live transport, or null when the runtime is not connected. */
  getTransport(): { getGuide(): Promise<GuideContent> } | null;
  /** Called with a user-facing error message when the guide cannot be written. */
  onError?(message: string): void;
}

const STATIC_CONFIRMATION_NOTICE =
  "This early guide is still being developed. It does not yet include visual aids or complete guidance for every feature. Copy a Chatobby Guide note in the vault root?";

/**
 * Download the Chatobby guide into the vault root. Prefers the runtime-owned
 * `get_guide` content (single source of truth, versioned, with its own
 * confirmation notice) and falls back to the bundled static guide when the
 * runtime is unavailable. Shared by the global tab-bar action and the Channels
 * page action so both stay in sync.
 */
export async function downloadChatobbyGuide(options: DownloadChatobbyGuideOptions): Promise<void> {
  let content = CHATOBBY_GUIDE_MARKDOWN;
  let filename = CHATOBBY_GUIDE_FILENAME;
  let notice = STATIC_CONFIRMATION_NOTICE;

  const transport = options.getTransport();
  if (transport) {
    try {
      const guide = await transport.getGuide();
      content = guide.content;
      filename = guide.path || filename;
      notice = guide.confirmationNotice || notice;
    } catch {
      // Runtime unavailable or old runtime without get_guide — use the bundled guide.
    }
  }

  const path = normalizePath(filename);
  const existing = options.app.vault.getAbstractFileByPath(path);
  if (existing && !(existing instanceof TFile)) {
    options.onError?.(`${filename} is already used by a folder.`);
    return;
  }

  const confirmed = await confirmAction(options.app, {
    title: existing ? `Replace ${filename}?` : `Add ${filename}?`,
    message: notice,
    confirmLabel: existing ? "Replace guide" : "Copy guide",
    destructive: false,
  });
  if (!confirmed) return;

  if (existing) await options.app.vault.modify(existing, content);
  else await options.app.vault.create(path, content);
  new Notice(`${filename} ${existing ? "updated" : "added"} in the vault root.`);
}
