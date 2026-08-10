# Chatobby 0.3.1

Chatobby 0.3.1 is a reliability update for existing 0.3.0 installations.

## Fixed

- Vaults whose memory data predates the session-continuity digest table can
  start and upgrade normally without manual database repair.
- Obsidian CLI failures and screenshot artifacts are reported accurately, so
  Chatobby can verify work with the appropriate Obsidian host evidence.
- High-consequence shell commands receive a dedicated one-shot review even
  when general shell access is allowed.
- Runtime and tool failures distinguish invalid input from unavailable views,
  timeouts, bridge failures, and integration defects.
- Connector builds now block on the local Community-review health gate, and
  generated Chatobby contracts remain typed and reviewable.
- Open Projects pages refresh when chats are created or completed in another
  Chatobby view, and switching back to Projects no longer leaves its catalogue
  behind a loading state.
- Project and Vault chats sort by real activity and support independent
  Project/chat filters plus bounded transcript search.
- Stored chats can move between Vault and Projects, delete without leaving an
  untitled placeholder, and export complete HTML or JSONL conversations.
- All folders attached to a Project are available to its chats and update
  active Project context without silently changing permission policies.

macOS and Linux support remain experimental pending representative physical
device acceptance.
