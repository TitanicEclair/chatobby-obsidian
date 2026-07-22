# Chatobby 0.1.16 public alpha

Chatobby 0.1.16 pairs with Runtime 0.1.16 and adds experimental native macOS
support while preserving the existing Windows installation and update flow.

> **macOS status:** Apple Silicon and Intel builds passed native GitHub macOS
> runner checks, including architecture and signature verification, clean-home
> startup, installer/update/rollback behavior, and signed-bundle installation.
> This alpha has not yet been verified by an external tester on a physical Mac
> and is not Apple-notarized.

## What changed

- Added exact runtime selection for Windows x64, Apple Silicon, and Intel Mac
  from a signed multi-platform release index.
- Added macOS-safe installation under the user's Application Support directory
  with private file modes, atomic activation, and rollback to the last
  known-good runtime.
- Added clear failure states for unavailable targets, architecture mismatch,
  invalid executable permissions, Gatekeeper blocks, and filesystem permission
  failures. Chatobby does not change macOS security settings or request `sudo`.
- Added macOS shell environment recovery for Obsidian launched from Finder.
- Retained the legacy signed Windows update descriptor for existing 0.1.x
  installations.
- Added a contributor guide so the public connector repository exposes its
  review, testing, and security-reporting expectations directly.

## Candidate verification

- The complete Windows x64, Apple Silicon, and Intel Mac production-candidate
  matrix passed.
- Each native runtime passed package signature, hash, architecture, startup,
  shutdown, installer, update, cancellation, and rollback checks.
- The matching connector passed TypeScript, architecture, public API,
  release-boundary, Community review-lint, and full test gates.
- The final connector and runtime assets were assembled from the same lockstep
  0.1.16 candidate.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
