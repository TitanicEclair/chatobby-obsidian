# Chatobby 0.5.0

## Native tabs and Projects

- Open chats, Memory, Channels and other Chatobby pages as Obsidian tabs, including splits. Chat tabs show the conversation name.
- Group chats into Projects, search from the sidebar and drag to reorder. Projects start with five chats; Vault chats start with 50. Choose **Show more** to expand a list.
- Archive a Project with its chats and restore it later. Permanent deletion removes Chatobby data and keeps attached note folders.
- New chats appear at the top and update their titles and working indicators as the agent runs. Long reasoning stays in a scrollable panel and folds when complete.

## Models and subscriptions

- Connect ChatGPT, GitHub Copilot and xAI subscriptions to Chatobby’s harness. API keys and supported token plans remain available.
- Connect an existing local server, find its models and test them individually. Use reported context and server output defaults, with per-model overrides when needed.
- Subscription sign-in opens your default browser. Account model lists refresh when you open the picker.

## Agents and Channels

- Keep specialist agents available for follow-up work, with custom role instructions, models and skills. Retired lifetime token and turn caps no longer stop continuing agents.
- Invite agents into a Channel to plan together, ask for another perspective or coordinate work. Invitations wake available sessions; addressed messages reach selected agents without waking the whole room.
- Send several steering messages while an agent works; Chatobby combines those waiting at its next intake.

## Memory, automation and Obsidian control

- Browse Vault or Project memory with one Viewing selector and Profile, Knowledge and Lessons filters. Agents maintain memory as work changes and query previous sessions more flexibly.
- Schedule Events for recurring work. Agents can compose independent tool calls and background work while keeping dependent steps in order.
- Ask Chatobby to operate Obsidian tabs, editors and settings, or build reusable QuickAdd and Templater workflows. Native guidance includes the Obsidian API reference and current local-model setup forms.

## Setup and workspace restrictions

- A short welcome points to model connections and the Chatobby Guide. Update highlights can be reopened from Settings.
- Choose Read-only, Workspace or Full access for a conversation. Read-only and Workspace restrict file and shell work to the selected Vault or Project. Network stays in the composer and starts On; Vault app access defaults On while preserving your explicit choices.
- Web tools report actual connection, search and extraction failures so the agent can choose a useful next step.

The core harness remains free, supports local models and has no telemetry. Chats
and memory are stored locally; connected services receive the requests you send
to them. macOS and Linux remain experimental.

## Roadmap

- More capable agent knowledge and memory systems.
- Additional chat modes and effort controls.
- Session chat annotations and inline note comments.
