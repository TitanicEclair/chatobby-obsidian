# Chatobby 0.1.12 public alpha

This candidate keeps the Community plugin aligned with Chatobby Runtime 0.1.12
and strengthens agent prompting for coding, delegation, memory, and tool-calling.

## What changed

- The agent now enforces a concrete risk taxonomy before consequential actions
  and runs `git status` before destructive git operations.
- Memory guidance includes an Applicable/Durable/Legible rubric, a timing
  discipline, and a skeptical-question trigger — durable learning improves
  across sessions.
- Coding discipline actively discourages compatibility hacks, speculative
  abstractions, premature error handling, and unnecessary comments.
- Subagent delegation is strengthened: "never delegate understanding," inline
  bounded work, no fan-out, and no re-deriving subagent findings.
- Communication leads with the outcome, keeps the final message self-contained,
  and abstracts tool names from user-facing text.
- Every prompt section carries provenance and authority-tier markers.
- Tool descriptions across the full surface now carry when-to-use /
  when-NOT-to-use guidance and mistake-proofing.

## Verification

- TypeScript, public API, architecture, and release-boundary checks pass.
- All 702 connector tests pass.
- The obsidian-agent prompt suite passes 98 tests; the mcp-server-obsidian suite
  passes 96 tests.
- A production-equivalent candidate is installed in a disposable test vault for
  manual verification before publication.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
