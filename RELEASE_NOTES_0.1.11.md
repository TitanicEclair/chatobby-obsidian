# Chatobby 0.1.11 public alpha

This candidate keeps the Community plugin aligned with Chatobby Runtime 0.1.11
and fixes permission and subagent lifecycle regressions found during workflow
testing.

## What changed

- **Allow for this session** now remains effective for direct web tools.
- Built-in Researcher and Deep researcher agents can use Chatobby web search and
  page fetching without a prompt on every call.
- Channel access uses the policy's channel grants without an unrelated second
  permission prompt.
- New subagents appear in the agent rail immediately, including during active
  streaming.
- Every prompt route now reaches one authoritative settled state, so child
  channel traffic cannot leave the Stop control, timer, or later input stuck.
- If input races with settlement, the idle runtime promotes it to a normal
  prompt and the connector removes its obsolete queued marker.
- Child channel delivery acknowledges receipt without waiting for the receiving
  agent's complete inference turn.

## Verification

- TypeScript, public API, architecture, and release-boundary checks pass.
- All 702 connector tests pass.
- Backend permission, coordinator, and WebSocket regressions pass, including a
  1,000-delta child stream while stopping a main turn with a waiting child.
- The production-equivalent candidate is installed in a disposable test vault
  for manual verification before publication.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
