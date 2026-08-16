# Chatobby 0.4.2

Chatobby 0.4.2 is a continuity, skills, memory, and Obsidian-work update. It
keeps long sessions more coherent while making the user-facing skill and
approval surfaces update reliably inside an already-open Chatobby view.

## Context and long-session continuity

- Mutable Project, permission, task, memory, runtime, channel, subagent, and
  Obsidian guidance now advances at the end of the conversation context. This
  preserves the stable prompt prefix for providers that support prompt caching
  while ensuring the newest authoritative revision wins.
- Loaded native and managed skills, discovered capabilities, retained-result
  handles, active work, decisions, and evidence now receive explicit bounded
  keep/drop treatment during context compaction.
- New unnamed sessions receive a concise title before their first ordinary
  response. The private bootstrap and checkpoint tools remain absent from the
  feed, exports, permission settings, and normal tool discovery.
- Current memory, Project instructions, permissions, active work, runtime
  capabilities, and selected Obsidian guidance remain available throughout a
  turn instead of disappearing after one model continuation.

## Skills and capability discovery

- Managed-skill changes refresh slash commands and open subagent role editors
  immediately; reopening the Chatobby view is no longer required.
- Invoked skills appear as compact message chips. Their full private
  instructions are context for the agent, not text attributed to the user.
- `@` file and folder lookup now remains active across spaces until Escape
  explicitly cancels it.
- Capability search supports explicit domains and bounded exact, prefix,
  ranked, and fuzzy discovery without loading every specialist schema into the
  initial prompt.
- Native and user/Project skill loaders now identify their separate catalogues
  clearly and suggest the other route when a skill was requested from the
  wrong one.

## Memory follow-ups

- Explicit follow-up commitments can be stored as typed memory obligations.
  The complete active set survives turns, compaction, and restart.
- Conversation, exact work-event, or time evidence must match before an
  obligation fires. Ambiguous evidence leaves it active, revisioned receipts
  prevent duplicate completion, and the eventual action still follows the
  current permission policy.
- Memory search adds structured filters, typo-tolerant ranked pagination,
  bounded multi-record reads, and atomic revision-checked maintenance so a
  short page is not mistaken for the entire store.

## Obsidian work

- Chatobby can discover the supported, version-pinned Obsidian API surface and
  attach focused symbol guidance only when an `obsidian eval` task needs it.
- Eval output is parsed as bounded structured JSON. Catastrophic operations are
  rejected through the canonical permission gate, while ordinary scripting is
  not blocked by an unnecessarily broad command list.
- An empty `AGENTS.md` now falls back to compatible `CLAUDE.md` guidance;
  non-empty `AGENTS.md` retains precedence.

## Interface and reliability fixes

- Obsidian application reload and restart now require a fresh user decision,
  even under Full access or after an earlier generic CLI approval.
- Failed compaction now reports its last maintenance stage and a bounded
  validator or provider-submission cause. Deterministic coverage guidance also
  makes correction attempts less fragile while preserving the original
  context if no checkpoint can be committed.
- Deferred approval cards recover their actions when a session feed becomes
  active again.
- The composer keeps text visible on hover and focus, and no longer places a
  tooltip over narrow model or effort controls.
- A compact animated `Working...` state appears while a submitted turn is
  waiting for its first provider event or next continuation.
- Main and child sessions keep isolated capability catalogues, preventing a
  duplicate tool source from blocking subagent launch or later discovery.

## Removed

The retired subagent-only Flows surface has been removed from the Agents page,
runtime tools, permissions, guidance, native skills, connector intents, and
public documentation. Existing definition files remain untouched but inert.

## Alpha platform status

Windows remains the primary physically tested desktop path. Native macOS and
Linux packages continue as best-effort experimental support pending a broader
physical-device acceptance matrix.
