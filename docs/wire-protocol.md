# Wire Protocol — WebSocket JSON-RPC

The Obsidian plugin communicates with the chatobby server over an authenticated
session **WebSocket** using a **JSON-RPC-like** protocol. Commands follow the
`{ id, method, params }` convention; responses are `{ id, type: "response",
result }` or `{ id, type: "error", error }`. Streaming events are a side-channel
on the same socket, not tied to a specific command id. The Obsidian bridge uses
its own second authenticated WebSocket.

> **Server source**: `C:\chatobby\pi-mono\packages\chatobby\src\ws-server.ts`, `ws-mode.ts`
> **Client SDK**: `C:\chatobby\pi-mono\packages\chatobby\src\ws-client.ts`
> **Type definitions**: [schemas.md](./schemas.md)
> **Credentials**: [credentials.md](./credentials.md) — API keys are NOT sent over this wire

---

## Connection Lifecycle

```
Plugin                              Chatobby Server
  │                                       │
  │──── WebSocket connect ───────────────>│
  │         ws://127.0.0.1:dynamic        │
  │──── RuntimeClientHello ──────────────>│
  │<─── RuntimeServerHello ──────────────│  (identity/auth/protocol complete)
  │                                       │
  │──── get_state ───────────────────────>│  (optional: check session exists)
  │<─── { state: WsSessionState } ───────│  (session id, model, streaming flags, counts)
  │                                       │
  │──── prompt { message } ──────────────>│  (start conversation)
  │<─── { status: "started" } ───────────│
  │                                       │
  │<─── { type: "event", event } ────────│  (streaming events, continuous)
  │<─── { type: "event", event } ────────│
  │<─── { type: "event", event } ────────│
  │                                       │
  │<─── { type: "extension_event" } ─────│  (optional: allowlisted Pi extension event)
  │<─── { type: "channel_event" } ───────│  (optional: vault channel update)
  │                                       │
  │<─── { type: "extension_ui_request" } │  (optional: UI interaction needed)
  │──── extension_ui_response ───────────>│
  │                                       │
  │──── WebSocket close ─────────────────>│
```

Managed mode gets the endpoint, instance/vault ids, protocol version, and
session token from `ChatobbyRuntimeManager`. The hello must complete before the
backend allocates a session runtime. Control status/detach/shutdown use a
separate scoped token and are not JSON-RPC agent commands.

---

## Command Reference

### Prompting

#### prompt

Send a user message to the agent. Returns immediately; stream events via the event channel.

```typescript
// Send
{ id: "ws_1", method: "prompt", params: {
  message: "Summarize what I am working on.",
  context?: {
    schemaVersion: 1,
    source: "obsidian",
    vault: "My vault",
    workspace: {
      workingDirectory: "Projects/Current",
      activeSurface: "note",
      isNewSession: true,
      sessionMessageCount: 0
    },
    privacy: { included: ["workspace"], omitted: ["note body outside excerpt"] }
  },
  attachments?: [
    // ImageContent for inline images
    { type: "image", data: "base64...", mimeType: "image/png" }
  ]
}}

// Receive
{ id: "ws_1", type: "response", result: { method: "prompt", status: "started" } }
```

**`message`** is the user's visible text. **`context`** is an optional typed
Obsidian packet containing bounded environment, workspace/session, active-note,
and open-note reference data. The backend escapes and fences it before the user
message; see [vault-context.md](./vault-context.md).

**`attachments`** is reserved but not wired in the current backend scaffold. Supplying attachments currently returns a handler error.

#### steer

Interrupt the current generation and inject a correction. The agent sees this as a mid-turn redirect.

```typescript
{ method: "steer", params: { message: "Actually, look at this file instead" } }
// → { method: "steer", status: "accepted" }
```

#### follow_up

Send a follow-up message without interrupting the current generation. Queued until the agent is idle.

```typescript
{ method: "follow_up", params: { message: "Can you also check the tests?" } }
// → { method: "follow_up", status: "started" }
```

#### abort

Stop the current generation immediately.

```typescript
{ method: "abort", params: {} }
// → { method: "abort", status: "aborted" }
```

### Session lifecycle

#### new_session

Start a fresh session. Previous conversation is discarded.

```typescript
{ method: "new_session", params: {} }
// → { method: "new_session", sessionId: "abc123" }
```

#### switch_session

Resume a previous session by path. The plugin applies local session preferences (model, thinking level) after switching, same as `new_session`.

```typescript
{ method: "switch_session", params: { sessionPath: "sessions/abc123.jsonl" } }
// → { method: "switch_session", cancelled: false }
```

#### fork

Fork from a specific point in conversation history. Creates a new session file. Returns the text of the forked-from message.

```typescript
{ method: "fork", params: { entryId: "msg_42" } }
// → { method: "fork", text: "Let me refactor this...", cancelled: false }
```

#### clone

Duplicate the current session at its current position.

```typescript
{ method: "clone", params: {} }
// → { method: "clone", cancelled: false }
```

#### navigate_tree

Switch branches in the session tree. Used for tree navigation UI.

```typescript
{ method: "navigate_tree", params: {
  targetId: "entry_42",
  summarize?: true,
  customInstructions?: "focus on tests",
  replaceInstructions?: false,
  label?: "explore alternative"
}}
// → { method: "navigate_tree", cancelled: false }
```

#### import_jsonl

Import a previously exported session.

```typescript
{ method: "import_jsonl", params: { inputPath: "exports/session.jsonl", cwdOverride?: "/project" } }
// → { method: "import_jsonl", cancelled: false }
```

### State & messages

#### get_state

Get the current session snapshot.

```typescript
{ method: "get_state", params: {} }
// → { method: "get_state", state: {
//     sessionId: "abc123",
//     model: "anthropic/claude-sonnet-4-20250514",
//     thinkingLevel: "medium",
//     isStreaming: false,
//     isCompacting: false,
//     sessionName: "refactor-auth",
//     sessionFile: "sessions/abc123.jsonl",
//     steeringMode: "all",
//     followUpMode: "all",
//     autoCompaction: {
//       enabled: true,
//       thresholdPercent: 85,
//       effectiveThresholdPercent: 81.8
//     },
//     messageCount: 12,
//     pendingMessageCount: 0
//   }}
```

#### get_messages

Get all messages in the current session.

```typescript
{ method: "get_messages", params: {} }
// → { method: "get_messages", messages: AgentMessage[] }
```

#### get_session_stats

Get session metadata for display: name, message count, token usage, model info.

```typescript
{ method: "get_session_stats", params: {} }
// → { method: "get_session_stats", stats: {
//     sessionFile: ".../session.jsonl",
//     sessionId: "abc123",
//     userMessages: 4,
//     assistantMessages: 4,
//     toolCalls: 2,
//     toolResults: 2,
//     totalMessages: 10,
//     tokens: { input: 45000, output: 12000, cacheRead: 0, cacheWrite: 0, total: 57000 },
//     cost: 0.42,
//     contextUsage: { tokens: 57000, contextWindow: 200000, percent: 28.5 }
//   }}
```

#### get_fork_messages

Get user messages the user can fork from. Populates a fork-point picker.

```typescript
{ method: "get_fork_messages", params: {} }
// → { method: "get_fork_messages", messages: [
//     { entryId: "msg_1", text: "Help me refactor auth" },
//     { entryId: "msg_5", text: "Now add tests" }
//   ]}
```

#### get_last_assistant_text

Get the last assistant response as plain text. For copy-to-clipboard workflow — the frontend handles clipboard itself.

```typescript
{ method: "get_last_assistant_text", params: {} }
// → { method: "get_last_assistant_text", text: "The capital is Paris." }
// or → { method: "get_last_assistant_text", text: null }
```

### Model & thinking

#### set_model

Change the active model.

```typescript
{ method: "set_model", params: { model: "anthropic/claude-opus-4-20250514" } }
// → { method: "set_model", model: "anthropic/claude-opus-4-20250514" }
```

#### cycle_model

Cycle to the next available model.

```typescript
{ method: "cycle_model", params: {} }
// → { method: "cycle_model", model: "claude-haiku-4-5-20251001" }
```

#### get_available_models

Get all models the user has credentials for. Populates a model picker UI.

```typescript
{ method: "get_available_models", params: {} }
// → { method: "get_available_models", models: [
//     { id: "claude-sonnet-4-20250514", name: "Claude Sonnet", provider: "anthropic" },
//     { id: "gpt-4o", name: "GPT-4o", provider: "openai" }
//   ]}
```

#### set_thinking_level

Set the thinking/reasoning level (`off`, `minimal`, `low`, `medium`, `high`, or `xhigh`).

```typescript
{ method: "set_thinking_level", params: { level: "high" } }
// → { method: "set_thinking_level", level: "high" }
```

#### cycle_thinking_level

Cycle through thinking levels.

```typescript
{ method: "cycle_thinking_level", params: {} }
// → { method: "cycle_thinking_level", level: "high" }
// or → { method: "cycle_thinking_level", level: null }  // if no more levels
```

### Session settings

#### set_session_name

Name a session for easy identification.

```typescript
{ method: "set_session_name", params: { name: "refactor-auth" } }
// → { method: "set_session_name" }
```

#### set_auto_compaction

Update automatic compaction for the active model. It is enabled by default.
The configured threshold is 50-95%; the effective trigger may be lower when
the backend must reserve more room for the model response.

```typescript
{ method: "set_auto_compaction", params: { enabled: true, thresholdPercent: 85 } }
// → { method: "set_auto_compaction", settings: {
//      enabled: true, thresholdPercent: 85, effectiveThresholdPercent: 81.8
//    }}
```

### Bash

#### bash

Execute a bash command on the server. The `excludeFromContext` flag prevents the command from appearing in the agent's context (useful for status checks).

```typescript
{ method: "bash", params: { command: "ls -la src/", excludeFromContext: false } }
// → { method: "bash", result: { output: "total 48\n...", exitCode: 0, cancelled: false, truncated: false } }
```

### Compaction & reload

#### compact

Trigger context compaction (summarizes old messages to free context window).

```typescript
{ method: "compact", params: {} }
// → { method: "compact" }
```

#### reload

Hot-reload extensions, skills, prompts. Dev workflow.

```typescript
{ method: "reload", params: {} }
// → { method: "reload" }
```

### Export

#### export_html

Export session as HTML for sharing.

```typescript
{ method: "export_html", params: { outputPath?: "exports/session.html" } }
// → { method: "export_html", path: "exports/session.html" }
```

#### export_jsonl

Export session as JSONL for backup/import.

```typescript
{ method: "export_jsonl", params: { outputPath?: "exports/session.jsonl" } }
// → { method: "export_jsonl", path: "exports/session.jsonl" }
```

### Discovery

#### get_commands

Discover available extension, skill, and prompt commands. Returns commands not hardcoded in the TUI.

```typescript
{ method: "get_commands", params: {} }
// → { method: "get_commands", commands: [
//     { name: "mcp", description: "Show MCP server status", source: "extension" },
//     { name: "refactor", description: "Refactor selected code", source: "skill" }
//   ]}
```

### Permission profiles

Permissions are backend-owned. The plugin loads a snapshot, then sends
revision-checked mutations instead of writing `.chatobby` policy files itself.

| Command | Purpose |
|---|---|
| `permissions_get_snapshot` | Load named profiles, active Main policy, MCP inventory, and visible subagent roles |
| `permissions_save_profile` | Create or update one custom profile |
| `permissions_set_active_profile` | Select the profile used by the main agent |
| `permissions_set_session_profile` | Select or clear the policy override for this session only |
| `permissions_delete_profile` | Delete an inactive, unassigned custom profile |
| `permissions_set_agent_assignment` | Set one subagent role to inherit or use an explicit profile |

Each command returns `{ method, snapshot }`. Mutation params carry the current
`expectedRevision`; a stale write returns an error and the client reloads.
Changes apply to the next authorization boundary of a running turn, but do not
interrupt a tool already in progress. See [permissions.md](permissions.md).

### Agent communication channels

Channel reads are vault-scoped and cursor-bounded. Agent connect/disconnect and
send operations happen through the agent tool surface; the plugin uses these
read/subscription commands to render the operator-facing channel page.

| Command | Purpose |
|---|---|
| `channels_get_snapshot` | Load channel definitions, memberships, and live agent identities |
| `channels_query` | Filter bounded history by channel, sender, recipient, kind, text, and cursor |
| `channels_subscribe` | Subscribe this WebSocket to live vault channel events |

After subscription, changes arrive as `{ type: "channel_event", event:
ChannelEvent }`. Messages contain immutable sender and recipient identity
snapshots plus a delivery status for each recipient.

### Subagent supervisor

Subagent orchestration uses first-class commands and a separate ordered event frame. Clients must load `subagents_get_snapshot` before subscribing with `subagents_subscribe { afterSequence }`.

| Command | Purpose |
|---|---|
| `subagents_get_snapshot` | Capabilities, current sequence, run summaries, definitions, workflows, and resolved settings |
| `subagents_list_runs` / `subagents_get_run` | Page run summaries or load one full node snapshot |
| `subagents_start_run` | Start one role or a reusable workflow under the active main session |
| `subagents_control` | Cancel, pause, resume, interrupt, steer, retry, reprioritize, append, fork/clone/adopt, reconcile, or decide a permission request |
| `subagents_subscribe` | Replay events after a sequence and continue live delivery |
| `subagents_list/save/delete_definitions` | Revision-checked role definition management |
| `subagents_list/save/delete_workflows` | Revision-checked workflow management |
| `subagents_validate/preview_workflow` | Validate a DAG or preview its execution plan without running it |
| `subagents_send_message` | Route a durable operator message to an exact supervised agent feed |
| `subagents_list_messages` / `subagents_acknowledge_message` | Load the operator inbox and durably acknowledge or answer a blocking request |
| `subagents_get_transcript` | Load a bounded node transcript page |
| `subagents_list/promote_artifacts` | Inspect child artifacts or promote one to an explicit vault path |
| `subagents_get/update_settings` | Read or update layered supervisor controls |

Live deltas use `{ type: "subagent_event", event: SubagentEvent }`. Every event carries `runtimeId`, monotonic `sequence`, `runId`, optional `nodeId`, causation metadata, and a typed run/node/message/artifact/tool/permission/budget/executor payload. Sequence gaps require a fresh snapshot.

### Extension UI

#### extension_ui_response

Respond to an extension UI request. See [Extension UI Bridge](#extension-ui-bridge) below.

### Persistent Events

| Command | Purpose |
|---|---|
| `events_set_operator_view` | Report visible Chatobby view state for view-closed consent checks |
| `events_get_snapshot` | Load definitions, bounded occurrence history, and running ids |
| `events_get_editor_options` | Load valid permission policies and agent roles for a selected project |
| `events_save_definition` | Create or revision-check/update an Event |
| `events_delete_definition` | Permanently delete a non-running Event |
| `events_set_enabled` | Pause or resume an Event with an expected revision |
| `events_trigger` | Run one definition through approval and budget policy |
| `events_trigger_command` | Trigger a named command with operator/agent/system origin |
| `events_approve_occurrence` | Approve one waiting occurrence |

The backend stores the authoritative state in
`<vault>/.chatobby/events/events.json`. Background execution needs both a
definition policy and user-granted consent; an agent cannot grant consent.

---

## Error Responses

Any command can return an error:

```typescript
{ id: "ws_1", type: "error", error: { code: "NOT_FOUND", message: "Session not found" } }
```

---

## Event Stream

Events arrive asynchronously on the same WebSocket, interleaved with responses:

```typescript
// Streaming text
{ type: "event", event: {
  type: "message_update",
  message: { role: "assistant", content: [...], ... },
  assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "Hello", partial: {...} }
}}

// Tool execution
{ type: "event", event: {
  type: "tool_execution_start",
  toolCallId: "tc_1",
  toolName: "bash",
  args: { command: "ls -la" }
}}

// Allowlisted extension event
{ type: "extension_event", event: {
  channel: "subagents:started",
  source: "@gotgenes/pi-subagents",
  timestamp: 1783180000000,
  data: { id: "agent-1", type: "Research", description: "Map API surface" }
}}
```

### AgentSessionEvent -> UI Mapping

```
agent_start           → Show streaming indicator, disable input
turn_start            → New turn begins (no action yet)
message_start         → Route by role: UserMessage → SystemBlock; AssistantMessage → new turn; ToolResultMessage → append to ToolBlock
message_update        → Incrementally render content (see below)
message_end           → Finalize message bubble
tool_execution_start  → Show tool call card
tool_execution_update → Update tool card with partial output
tool_execution_end    → Finalize tool card (also finalizes ToolBlock when all tools done)
turn_end              → Assistant response done — tool execution may still be in progress
agent_end             → Hide streaming indicator, enable input
```

### message_update Rendering

The `assistantMessageEvent` sub-type drives incremental rendering:

| Sub-type | Action |
|----------|--------|
| `text_delta` | Append `delta` to current text block |
| `text_end` | Text block done — can now render markdown |
| `thinking_delta` | Append to collapsible thinking block |
| `thinking_end` | Thinking block done |
| `toolcall_delta` | Tool call arguments being assembled |
| `toolcall_end` | Tool call ready — show card with `name` + `arguments` |
| `done` | Turn complete (reason: stop/length/toolUse) |
| `error` | Turn failed (reason: aborted/error) |

### Extension Events

`extension_event` is a top-level server-to-plugin frame for normalized Pi
extension events:

```typescript
interface WireExtensionEvent {
  channel: string;
  source: string;
  timestamp: number;
  data: Record<string, unknown>;
}
```

The legacy extension compatibility catalog recognizes these gotgenes lifecycle channels:

```
subagents:created
subagents:started
subagents:completed
subagents:failed
subagents:steered
subagents:compacted
```

Chatobby's active runtime disables the gotgenes extension and uses first-class
`subagent_event` frames. The plugin adapts run-level deltas into one compact
feed block keyed by durable `runId`; detailed node, transcript, permission,
message, acceptance, and artifact state remains in the dedicated screen store.

---

## Extension UI Bridge

When an extension running on the server calls `ctx.ui.select(...)` or similar, the server sends a `extension_ui_request` to the plugin. The plugin must render native Obsidian UI and respond.

### Request → Response Flow

```
Server (extension calls ctx.ui.select) 
  → { type: "extension_ui_request", request: { id: "ui_1", method: "select", params: {...} } }
  → Plugin renders Obsidian Modal/Dropdown
  → User picks option
  → { method: "extension_ui_response", params: { id: "ui_1", result: "chosen option" } }
```

### UI Methods

#### select — Blocking

Show a selection dialog. Return the chosen option string.

```typescript
// Request params
{ title: string; options: string[]; signal?: AbortSignal; timeout?: number }

// Response result
string  // the chosen option
```

#### confirm — Blocking

Show a yes/no confirmation. Return boolean.

```typescript
// Request params
{ title: string; message: string; signal?: AbortSignal; timeout?: number }

// Response result
boolean
```

#### input — Blocking

Show a text input. Return the entered string.

```typescript
// Request params
{ title: string; placeholder?: string; signal?: AbortSignal; timeout?: number }

// Response result
string | undefined
```

#### editor — Blocking

Show a multi-line text editor. Return the edited text.

```typescript
// Request params
{ title: string; prefill?: string }

// Response result
string | undefined
```

#### notify — Fire-and-forget

Show a notification toast.

```typescript
// Request params
{ message: string; type?: "info" | "warning" | "error" }

// No response needed
```

#### setWidget — Fire-and-forget

Set a widget above/below the editor.

```typescript
// Request params
{ key: string; content: string[] | undefined; placement?: "aboveEditor" | "belowEditor" }

// No response needed
```

#### setTitle — Fire-and-forget

Set the window/tab title.

```typescript
// Request params
{ title: string }

// No response needed
```

### Timeout Handling

Blocking requests may include a `timeout` (ms) and `signal` (AbortSignal). If the timeout expires or the signal fires, the plugin should dismiss the UI and send a response with `undefined`/`null` result.

---

## Message Framing

Each WebSocket message is a single JSON object (no newline delimiters, no batching). The `ChatobbyWsClient` SDK handles serialization and request/response correlation automatically.

### Client SDK Usage

```typescript
import { ChatobbyWsClient } from "@chatobby/chatobby/client";

const client = new ChatobbyWsClient({ url: "ws://localhost:9222" });
await client.connect();

// Subscribe to streaming events
client.onEvent((event) => {
  if (event.type === "event") {
    handleAgentEvent(event.event);
  } else if (event.type === "extension_event") {
    handleExtensionEvent(event.event);
  } else if (event.type === "extension_ui_request") {
    handleExtensionUI(event.request);
  }
});

// Handle extension UI requests
client.onExtensionUI(async (request) => {
  switch (request.method) {
    case "select": return await showObsidianSelect(request.params);
    case "confirm": return await showObsidianConfirm(request.params);
    case "input": return await showObsidianInput(request.params);
    // ...
  }
});

// Send commands
await client.prompt("Hello, agent!");
await client.abort();
const state = await client.getState();

// Session lifecycle
await client.switchSession("sessions/abc123.jsonl");
const fork = await client.fork("msg_42");
await client.clone();
await client.navigateTree("entry_42", { summarize: true });

// Model & thinking
await client.setThinkingLevel("high");
const models = await client.getAvailableModels();

// Session metadata
const stats = await client.getSessionStats();
const last = await client.getLastAssistantText();
await client.setSessionName("my-session");

// Export & discovery
await client.exportHtml();
const commands = await client.getCommands();
```
