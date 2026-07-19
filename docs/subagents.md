# Subagents guide

Subagents are supervised workers for a bounded part of a larger task. They keep
their own feed, appear in the agent rail, and report results back to the main
session. They are not background daemons or permanent listeners.

## When delegation helps

Use one or more subagents when work can be separated cleanly, for example:

- research a defined question from at most five sources;
- inspect one subsystem while the main agent studies another;
- review a proposed edit without making changes;
- run a focused verification in an isolated worktree;
- compare two independent interpretations before the main agent reconciles
  them.

Do not delegate merely to make a simple task look sophisticated. The main agent
still owns scope, supervision, permission decisions, evidence reconciliation,
and the final response.

## Write a bounded assignment

Every launch should specify:

- the concrete objective;
- what is in and out of scope;
- allowed sources and mutations;
- required output format and evidence;
- acceptance checks;
- permission policy;
- limits and stop conditions that match the task.

Example:

> Launch one research subagent to compare these two claims. Use no more than
> five primary sources, do not edit files, return a short evidence table with
> links, and stop after the comparison is complete. Use the web-research policy.

“Be concise” is not a measurable boundary. A source cap, exact deliverable, tool
cap, or acceptance check is much more reliable.

## Roles and one-off runs

A reusable role is useful when the same kind of worker needs consistent
instructions, model, policy, and limits. A one-off run can receive a permission
policy directly; you should not have to create a temporary role merely to give
one child web-only or read-only access.

Choose purpose-specific roles such as focused research, deep research,
exploration, coding, or review. Their instructions should differ in evidence
depth, mutation authority, output expectations, and stopping conditions instead
of relying on a title alone.

## Limits and lifecycle

Subagents may be bounded with turns, tokens, total tool calls, named-tool calls,
or wall-clock time. Use these only where they express the real task boundary.
Ordinary subagents should not inherit a naive short timeout. A wall-time limit is
appropriate for a time-boxed check, not for keeping an idle worker available for
a later message.

A normal child response ends that model turn. The child may remain waiting and
addressable so the main agent can send a follow-up, but it is not continuously
polling a channel. A message delivered to an idle child should activate a new
turn through the channel/control system when that is the intended interaction.

Lifecycle controls have distinct purposes:

- **message** supplies additional information;
- **steer** redirects current work;
- **interrupt** ends the current model turn;
- **cancel** terminates the run;
- **retry** starts a new attempt;
- **complete** closes reviewed direct-child work;
- **reconcile** recovers an orphan after a backend restart.

Refresh the run after a control race. If the child completed between observation
and a steer request, the fresh terminal result is authoritative and the UI
should report “already completed,” not an unexplained missing node.

## Permissions and communication

Bind the least-authority policy at launch. A subagent cannot alter or bypass its
policy through instructions. When it needs user approval, the request should be
visible to the main session so the user can decide without hunting through every
child feed.

Direct user-facing messages belong in the addressed agent's session feed.
Agent-to-agent communication belongs in an authorized Channel, where sender,
recipient, root session, and relevant project identity can be inspected. The
main agent should review important child claims against primary evidence before
using them in the final answer.

## Moving around the UI

The agent rail is the session-level switcher. It should show the main agent and
the current live children, update as lifecycle state changes, and let you move
between feeds without creating fake navigation history. Completed work remains
in its original chronological place in the feed rather than being repeated at
the bottom of later turns.

The Subagents page is for runs, inbox messages, roles, workflows, and settings.
Opening a child's feed is not the same as opening that page.

## When to use a workflow instead

Use a saved [workflow](workflows.md) when the same finite multi-step graph will
be reused, when dependencies must be validated, or when fan-out, fan-in, and
acceptance gates need durable structure. Use direct subagents for interactive,
one-off delegation that the main agent will supervise closely.

## Troubleshooting

- **The child asked for unexpected permission:** inspect its effective policy
  and the exact surface/path/tool check; do not create a broader policy blindly.
- **The child stopped too soon:** check explicit wall-time, token, turn, and tool
  limits as well as provider errors.
- **The child consumed excessive tokens:** tighten context mode and assignment,
  bound sources and tools, and inspect cache/input accounting separately from
  generated output.
- **A channel message received no reply:** verify that delivery activates a new
  child turn rather than merely persisting a message for a non-polling worker.
- **The rail is stale:** refresh runtime state and inspect the run's durable
  lifecycle; navigation should not be required to make a new child appear.

