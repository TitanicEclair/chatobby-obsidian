# Chatobby 0.3.4

Chatobby 0.3.4 improves Project work across several vault or external folders,
composer references, and finding exact messages in stored chats.

## Improved

- Create a Project from several existing vault or external folders in one
  all-or-nothing operation, choose its primary folder, and keep external
  folders in their real location instead of creating a vault copy.
- Add or repair Project folders with clear primary, attached, unavailable, and
  device-only states. Every available Project folder receives the same
  Project-root permission treatment while the active policy remains in charge.
- See the current chat's effective permission policy separately from the
  installation default, including after switching policies or reconnecting.
- Type `@` to find files and folders from the running Project, navigate the
  scrollable suggestion list, and keep selected references as compact openable
  chips without granting extra permission.
- Search inside stored Project chats with bounded pages of exact excerpts, then
  resume the conversation at the highlighted matching message.
- Use the full-width previous-prompt bar without automatic bottom pinning
  overriding message navigation.
- Restore each Chatobby leaf's exact Project session before accepting a prompt
  after a runtime reconnect.

macOS and Linux support remain experimental pending representative physical
device acceptance.
