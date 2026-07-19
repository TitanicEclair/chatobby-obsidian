# Workflows guide

Workflows connect several bounded agent roles into a reusable, finite execution
graph. Use one when the structure, dependencies, review gates, or fan-out are
important enough to save. For a one-off piece of delegated work, start with a
single [subagent](subagents.md) instead.

## The building blocks

| Item | Meaning |
|---|---|
| Task | Progress in the current main-agent session |
| Role | Reusable instructions, model, permission policy, and limits for a worker |
| Workflow | Revisioned definition of nodes and dependencies |
| Run | One execution of a saved workflow |
| Node | One role performing one bounded step in that run |

The main agent remains responsible for the design, monitoring, evidence review,
recovery, and final response. A workflow does not make its children independent
supervisors and does not bypass permission policy.

## Start with a small workflow

A useful first design is source -> review -> summary:

1. **Source:** gather a bounded set of evidence and return structured findings.
2. **Review:** inspect the source output, identify weak claims, and return an
   acceptance decision or corrections.
3. **Summary:** consume only accepted evidence and write the final result.

You can ask:

> Design a reusable workflow with a source researcher, an evidence reviewer,
> and a final summarizer. Give every node a narrow task, truthful dependencies,
> explicit permission policy, and reasonable limits. Validate and preview it,
> but do not save or run it until I approve the preview.

## Design rules that prevent confusing runs

- State the objective, allowed sources, prohibited mutations, required output,
  acceptance checks, and stop condition for every node.
- Add every dependency whose result a node consumes. Do not rely on node order
  as an undocumented data dependency.
- Keep shared-workspace writers sequential. Parallelize independent research,
  review, or isolated work.
- Prefer structured output when a later node must consume exact fields.
- Use fan-out only when a source produces a bounded list of independent items.
  Set a hard maximum item count and finish with a fan-in node when results must
  be reconciled.
- Choose parent context deliberately. A fresh worker should not inherit a large
  conversation by accident; dependency output is delivered separately.
- Avoid a permanent or very large workflow for work that is easier to supervise
  as one direct subagent task.

## Permissions and limits

Bind the least-authority permission policy needed by each role or node. A
one-run policy can be assigned at launch when the whole run shares the same
authority. A child asking for access should surface a permission request for the
main session rather than silently widening its policy.

Limits are circuit breakers, not estimates of how long good work should take:

- `max_turns` bounds model iterations;
- `max_tokens` bounds total model usage and should accommodate the initial
  context plus a response reserve;
- `max_tool_calls` bounds tool activity;
- `max_wall_time_ms` is useful only when the task has a real deadline.

Do not apply a short wall-clock timeout to an ordinary research or coding node
merely because the field exists. Preview should warn when a token budget cannot
even accommodate the estimated initial request, and launch should reject such a
run before contacting the provider.

## Validate, preview, save, run

1. Discover the exact role, policy, workflow, and run identifiers in the
   current project.
2. Inspect an existing workflow before editing it.
3. Validate the complete draft.
4. Preview the exact draft and review dependency, budget, model, policy, and
   tool checks. Some live checks may be deferred until launch.
5. Preserve the returned draft fingerprint. If the draft changes, validate and
   preview it again.
6. Save only after approval, then launch the intended revision.
7. Monitor durable run state and waiting reasons rather than inferring progress
   from chat messages alone.
8. Review the results, then retry or reconcile only the affected node when it
   is safe.

A workflow node normally completes on its first valid, non-empty response.
Permission waits, user messages, and acceptance review are distinct waiting
states and should be handled as such.

## Troubleshooting

- **A node cannot start:** inspect its effective policy, model, tools, input
  budget, and dependencies. Preview output may explicitly identify a deferred
  launch-time check.
- **A run looks stuck:** refresh durable run state and read the exact waiting
  reason before steering or cancelling anything.
- **A control says the node is missing:** refresh once. It may have become
  terminal between the previous observation and the control request.
- **A worker used too much context:** choose fresh or selected context, tighten
  its assignment, and avoid sending the full parent branch unnecessarily.
- **A child exceeded scope:** revise the role instructions and add measurable
  source, tool, turn, or output limits rather than relying on “keep it concise.”
