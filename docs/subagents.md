# Subagents guide

Subagents are persistent collaborators with their own conversation, role and
model. A researcher can gather evidence while a reviewer challenges assumptions;
you and the parent can return with another question in the same conversation.

## Start with a useful responsibility

Ask for delegation in an ordinary Chatobby conversation. Describe the objective,
sources, allowed changes and the evidence you want back. The parent remains
responsible for coordinating work and checking important claims.

> Keep a researcher and a reviewer available for this Project. Ask the researcher
> to compare these three notes, then have the reviewer identify weak assumptions.
> Return a practical draft with links to the evidence. We will refine it together.

A reusable role saves instructions, a model and user skills. Manage roles for the
Vault or a selected Project from **Subagents → Roles and settings → Roles**. Changing this editing
area does not move your conversation. New agents inherit the initiating
session's workspace and app-access choices. In 0.5.3 all agents have Full file,
command and network access; sandboxing is temporarily unavailable.
Older roles with a retired permission-profile override remain marked for review.
Saving the role removes that override and adopts the current policy.

## A response ends a turn

An agent stays available after answering. A follow-up or delivered channel message
can start another turn. Idle agents do not poll or consume model turns just to
remain available.

Chatobby imposes no lifetime token, turn, cost, tool-call, wall-time, concurrency
or delegation-depth caps. Old saved cap values are ignored and removed by normal
settings and role saves. Provider limits, model context windows, machine resources
and provider charges still apply.

Use **Stop** to end an agent's work. Ending an individual turn does not complete
an ongoing responsibility. Complete an agent only when that responsibility ends.

## Conversations, not a run inspector

The native **Chatobby – Subagents** tab leads with parent conversations and their
agents. Open a parent's saved chat, read an agent's conversation, send a follow-up,
or stop active work. Earlier conversations remain available in the history list.
The chat header's compact **Subagents** dropdown also opens child conversations.
Obsidian owns the tabs, so you can arrange Chatobby beside your notes.

The old task/result inspector, Retry, Clone, Fork, priority and budget-extension
controls have been retired. Start new work from the relevant parent conversation
so it receives the current workspace and policy.

## Channels and direct messages

A Channel is a durable coordination room. An invitation to a live session delivers
a host notification and starts a turn when the session is idle. The invited agent
is instructed to join unless earlier user instructions say otherwise. Joining
still passes the existing membership and permission checks.

A channel DM targets one agent's delivery instead of waking every member. It
remains part of shared channel history: **DM means targeted delivery, not private
history**. Broadcast when everyone needs an update; DM an individual question.
Replies should address the sender without creating endless acknowledgement loops.

Invitations and messages do not move a chat's workspace or change its
Obsidian grants. Delivery receipts distinguish successful delivery, unavailable
recipients and failures. An invitation cannot wake a session that is not live.

## Recovery and troubleshooting

- **A runtime restart interrupted an agent:** the previous active incarnation is
  marked as needing recovery. Reconciliation starts an explicit new attempt;
  automatic continuation across runtime restarts is not yet guaranteed.
- **A message received no reply:** check membership, whether the recipient is
  live, and the delivery receipt. Accepted delivery is distinct from a model
  completing its response.
- **An agent stopped unexpectedly:** inspect the provider error or interruption
  in its conversation. Retired lifetime caps are not used to stop it.
- **Work is becoming expensive:** narrow the responsibility and context, choose
  a suitable model, inspect usage and stop agents you no longer need.
- **A role requests an old permission profile:** review and save it under the
  current policy before launching it again.
