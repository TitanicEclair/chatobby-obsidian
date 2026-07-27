export interface GuideFile {
  path: string;
  title: string;
  content: string;
}

export const CHATOBBY_GUIDE_DIRECTORY = "Chatobby Guide";
export const CHATOBBY_GUIDE_FILENAME = `${CHATOBBY_GUIDE_DIRECTORY}/00 - Start Here.md`;

export const CHATOBBY_GUIDE_MARKDOWN = `# Chatobby Guide

> [!note] Early guide
> Chatobby is still in active development. This guide does not yet include visual walkthroughs or every advanced feature.

Chatobby gives you an AI workspace inside Obsidian. You can have a normal conversation, ask it to work with your notes, let it carry out a longer plan, or connect it to optional services. You remain in control of the project, model, and permissions it uses.

You do not need to learn every feature before starting. Open a session, choose a folder, and describe what you want in ordinary language.

## Start with what you want to do

- [[01 - Sessions and vault work|Chat with your vault and work on notes]]
- [[02 - Permissions and safety|Choose what Chatobby may do]]
- [[03 - Memory and instructions|Teach Chatobby preferences and project rules]]
- [[04 - Subagents tasks and channels|Divide work between agents and let them communicate]]
- [[05 - Events and context queries|Schedule recurring work or add live project information]]
- [[06 - Plugins and MCP services|Connect GitHub, calendars, and other services]]
- [[07 - Models and providers|Choose an AI provider and model]]
- [[08 - Examples and recipes|Copy useful example requests]]
- [[09 - Troubleshooting and limits|Fix common problems and understand limits]]

## A useful first request

Good requests explain the result you want, where Chatobby should look, what it may change, and how careful it should be.

> Review the notes in \`Projects/Move\`, tell me which decisions are still open, and suggest the next three steps. Do not edit anything yet.

That request is useful because Chatobby knows the folder, the outcome, and the safety boundary. You can follow it with:

> Update only \`Projects/Move/Plan.md\` with the decisions we agreed on, then reopen it and check that its links still work.

## Three ideas that make Chatobby easier to use

1. **Begin read-only when you are unsure.** Ask Chatobby to inspect and explain before it changes anything.
2. **Use projects to set boundaries.** The directory shown at the top of a Chatobby view tells you which part of the vault the session belongs to.
3. **Use permission policies for repeatable trust.** A policy can let one session research freely while keeping another session read-only.

## What Chatobby cannot promise

AI models and connected services can be wrong, unavailable, or incomplete. Chatobby can check its work and show what it used, but important medical, legal, financial, security, and destructive decisions still need human review.

[[08 - Examples and recipes|Try example requests]] · [[09 - Troubleshooting and limits|Get help]]
`;

export const CHATOBBY_GUIDE_FILES: readonly GuideFile[] = [
  { path: CHATOBBY_GUIDE_FILENAME, title: "Chatobby Guide", content: CHATOBBY_GUIDE_MARKDOWN },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/01 - Sessions and vault work.md`,
    title: "Sessions and vault work",
    content: `# Sessions and vault work

A Chatobby session is a conversation with its own project folder, model, permission policy, history, and ongoing work. Think of each Obsidian tab as a separate desk: one can organize a course while another researches a trip without mixing their files or instructions.

## Start a session

1. Open Chatobby from the ribbon or command palette.
2. Choose the folder that best represents the work. Choose the vault root only when the work genuinely spans the whole vault.
3. Below the composer, choose a permission policy, provider, model, and effort level.
4. Describe the outcome in normal language.

The directory name at the top is clickable and returns you to that session’s main conversation. If you start work in another folder, Chatobby opens another view instead of silently changing the current session’s meaning.

## What you can ask Chatobby to do

Chatobby can find related notes, compare ideas, create or revise notes, preserve links and frontmatter, organize a folder, and help carry a project from exploration to a checked result.

> In \`Biology\`, find my notes about cellular respiration. Explain what is incomplete, update only the overview note, and check the rendered note for broken links or blocks.

For a large request, ask it to make a plan first:

> Review this project and make a five-step plan. Show me the plan before editing files.

The task strip above the composer shows which step is currently active. It disappears after the work is complete.

## Moving between sessions

Use Obsidian tabs for separate main sessions. The agent rail at the top switches between the main agent and its subagents. Opening Memory, Events, Permissions, Channels, or Plugins should not cancel a running turn.

Use **Stop** when you want active work to end. If you press Escape immediately after sending and the agent has not begun meaningful output or tool use, Chatobby can return that message to the composer.

## Give a project lasting instructions

Create a \`.chatobby.md\` file in a project folder when rules should apply every time Chatobby works there. This is useful for:

- required note templates;
- naming or linking conventions;
- preferred sources;
- folders that must not be edited;
- how finished work should be checked.

Example:

> Keep literature notes in \`Sources\`. Never replace quoted text. Use YYYY-MM-DD dates. After editing a Dataview block, check the rendered note for errors.

\`AGENTS.md\` can also provide instructions, especially for coding projects. Keep rules short, specific, and relevant to the folder.

## Tips

- Name exact notes when you know them; describe the idea when you do not.
- Say “do not edit yet” when you only want an assessment.
- Ask for verification when work contains links, frontmatter, HTML, CSS, Dataview, or another plugin’s syntax.
- Start a new session when the project or purpose changes substantially.

[[00 - Start Here|Guide index]] · [[02 - Permissions and safety|Choose permissions]] · [[08 - Examples and recipes|See examples]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/02 - Permissions and safety.md`,
    title: "Permissions and safety",
    content: `# Permissions and safety

Permission policies are reusable sets of boundaries. They let you decide whether an agent can read notes, edit files, use the web, run commands, message channels, or use tools from a connected plugin.

## The three choices

- **Allow**: the action can continue without interrupting you.
- **Ask**: Chatobby pauses and shows what the agent wants to do.
- **Deny**: the action is blocked.

For example, a “Read-only research” policy might allow note reading and web research while denying every editing tool. A “Project editor” policy might allow edits only inside one project and ask before commands or external services.

## Editing a policy is not assigning it

The policy selector at the top chooses which policy you are viewing or editing. It does not silently give that policy to an agent.

To make an agent use it:

1. Open **Permissions**.
2. Choose or duplicate a policy.
3. Edit its capability groups and channel access.
4. Select **Use for this session**. Each Chatobby view manages its own session.
5. For future subagents or events, choose the policy in their role or event setup.

The composer shows the current session policy. You can click its name to switch the session to another available policy.

## Capability groups and individual tools

Start with broad, understandable groups such as note reading, editing, web access, agent channels, or connected plugins. Expand a group only when one tool needs a different choice.

Connected MCP plugins appear in their own sections after their tools are discovered. New connected tools begin denied in every policy until you explicitly allow them. Installing or connecting a service never grants tool access by itself.

## Let agents use channels

Channel communication has two layers:

1. Under **Capabilities**, find **Agent channels** and choose whether the policy may use channel tools.
2. Under **Channel access**, add the channels the policy may connect to, read, or send messages in.

Assign that policy to the main session, subagent role, or event that needs it. See [[04 - Subagents tasks and channels|Subagents, tasks, and channels]] for a complete example.

## A safe way to make a policy

1. Duplicate the closest existing policy.
2. Give the copy a purpose-based name.
3. Deny capabilities the job does not need.
4. Use Ask for actions you want to review individually.
5. Assign the policy to the intended agent.
6. Test one action that should succeed and one that should be blocked.

> Create a policy named “Travel researcher.” Allow web research and note reading. Deny note editing, commands, and external messaging. Do not assign it yet.

## Timing and safety

Policy changes apply to later tool calls. A request already received by an external service may not be recallable, so stop active work before tightening permissions when timing matters.

Chatobby also has built-in operating and safety instructions. Your messages, memories, and project instructions add context, but cannot remove those protected requirements.

If an exact capability is denied and still succeeds, stop the session, copy diagnostics, and report it as a security bug.

[[00 - Start Here|Guide index]] · [[04 - Subagents tasks and channels|Agent communication]] · [[06 - Plugins and MCP services|Plugin permissions]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/03 - Memory and instructions.md`,
    title: "Memory and instructions",
    content: `# Memory and instructions

Memory helps Chatobby carry useful knowledge into later conversations. It is best for facts, preferences, decisions, and corrections that may matter again.

Examples:

- “I prefer short study summaries followed by practice questions.”
- “This project uses \`Calendar/Work.md\` for work appointments.”
- “The finance dashboard treats refunds as negative income.”
- “When I say ‘the course’, I mean Y3S1 unless I name another term.”

## Memory or project instructions?

Use **memory** when information should be retrieved when relevant. Use \`.chatobby.md\` when a rule must always guide work in that project.

| You want Chatobby to… | Use |
|---|---|
| Remember a preference that may matter later | Memory |
| Always follow a project naming rule | \`.chatobby.md\` |
| Run a calculation at the start of sessions | Context query |
| Repeat work on a schedule | Event |
| Learn a reusable procedure with supporting files | Skill |

## Ask Chatobby to remember something

Say what should be remembered, where it applies, and why:

> Remember for this project that “add to my calendar” means adding an entry to \`Calendar/Work.md\`, unless I name another calendar.

Chatobby may suggest a memory in the conversation. You can approve it, reject it, or ignore it. Ignored suggestions remain pending on the Memory page; they are not silently approved.

## Understand memory scopes

- **Vault profile** describes how you generally prefer to work.
- **Vault memory** stores knowledge that can help across the vault.
- **Project memory** belongs to the selected project hierarchy.
- **Lessons and corrections** preserve useful failures and corrected approaches.

A parent project does not read memories owned by a child project. A child can exclude inherited project memories, or isolate all memory so it also excludes vault-wide memory. This lets unrelated or sensitive projects stay separate.

## Review and clean memory

Use category filters and sorting to find older, recently used, or project-specific records. Expand a record to see its full text, edit it, archive it, delete it, or review its history.

For a large cleanup, ask Chatobby to inspect the complete relevant memory scope before proposing changes. A short search result is ranked for relevance and does not prove that no other records exist.

## Tips

- Store one clear idea per memory.
- Include the reason when a preference would otherwise be ambiguous.
- Correct outdated memories instead of adding a conflicting duplicate.
- Use project isolation for unrelated clients, courses, or private work.
- Review important deletion or consolidation proposals yourself.

[[00 - Start Here|Guide index]] · [[01 - Sessions and vault work|Project instructions]] · [[05 - Events and context queries|Computed context]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/04 - Subagents tasks and channels.md`,
    title: "Subagents, tasks, and channels",
    content: `# Subagents, tasks, and channels

Chatobby can divide work between agents. Subagents handle bounded pieces of a task, the task strip shows the plan, and Channels let agents exchange information like a group chat.

## Subagents

A subagent is a supervised worker with its own feed, role, model choices, and permission policy. The agent rail at the top lets you switch between the main agent and each active or recent subagent.

Subagents are useful when work can be separated:

- one searches your vault while another checks current web sources;
- one drafts an answer while another reviews it;
- several researchers compare different choices;
- a specialist handles a clearly bounded technical step.

Give a subagent one outcome, a clear scope, and a stopping condition:

> Use two research subagents. One compares the notes in \`Travel/Maldives\`; the other checks current official entry requirements. Each should return at most five findings and stop. Do not edit the vault.

Choose a role and permission policy that match the job. Avoid arbitrary short timeouts for open-ended work; use a limit only when the task truly has a time, turn, or cost boundary.

## Tasks

For longer work, the task strip above the composer answers “what is happening now?” It shows the active step without replacing the conversation. Expand it to review the whole plan. You cannot manually mark an agent’s tasks complete; the agent updates them as work progresses.

## Channels are agent group chats

Chatobby’s Channels page allows the main agent, subagents, and other active sessions to communicate through durable messages, much like a group chat.

This is useful when one agent discovers something another agent needs. A research subagent can send findings to the main agent immediately, or two active sessions can coordinate without you copying text between them. Messages remain visible on the Channels page so you can review who said what and which session it came from.

### Give an agent channel access

1. Open [[02 - Permissions and safety|Permissions]].
2. Choose the policy the agent will use.
3. Under **Capabilities**, find **Agent channels** and choose Allow, Ask, or Deny.
4. Under **Channel access**, add the channel and choose whether the policy may connect, read, and send.
5. Assign the policy to the main session, a subagent role, or an event.
6. Open **Channels** to watch messages arrive.

An agent needs both the channel capability and access to the specific channel. This prevents a broadly useful policy from automatically joining every conversation.

### Channel message or subagent control?

- Use a **channel message** to share findings, ask a question, or reply.
- Use **subagent controls** to stop, resume, redirect, or finish a worker.
- Use the agent rail to open a subagent’s own feed and review its work.

A message addressed to a live agent wakes it for delivery. A waiting agent remains addressable without continuously spending model tokens. Agents should not repeatedly poll a channel for updates.

## Example workflow

> Create a channel for this project. Launch a vault researcher and a web researcher using the “Research” policy. Ask each to send its findings to the channel, then combine those messages into one answer with note paths and source links.

## Tips

- Use descriptive channel names such as “Weekly review” or “Move research.”
- Keep messages about one shared purpose in one channel.
- Give each subagent a narrow task instead of launching several agents with the same vague request.
- Let the main agent know whether it should wait for every worker or continue with partial results.
- Remove or archive channels that no longer represent active work.

[[00 - Start Here|Guide index]] · [[02 - Permissions and safety|Set channel permissions]] · [[08 - Examples and recipes|Try a multi-agent example]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/05 - Events and context queries.md`,
    title: "Events and context queries",
    content: `# Events and context queries

Events and context queries help Chatobby act with the right timing and information. They solve different problems: an event starts work; a context query supplies small pieces of current data.

## Events start sessions automatically

An event is a saved instruction that runs on a schedule. Every event run creates a normal session you can open, review, continue, or stop.

Useful examples:

- review overdue project tasks every Friday;
- prepare a daily study plan;
- summarize changes in a project each morning;
- check a recurring source and create a report.

When creating an event, choose its project, agent, permission policy, time, repeat rule, end date, daily run limit, and maximum runtime.

> Create a disabled event for every Monday at 9:00 AM. In \`Projects/Weekly Review\`, open a session, summarize unfinished tasks, and suggest priorities. Use the read-only review policy.

Keep the event disabled while you inspect its definition. Run it once manually, check the resulting session, then enable repetition.

## Context queries add current information

A context query is a small project-owned script that returns concise information at the start of a session or before each user turn. You do not need to see the script in the Queries page; the page shows its name, purpose, timing, and enabled state.

Useful examples:

- today’s local date;
- the current sprint name and deadline;
- a small status read from another local file;
- a short list of active project IDs.

A context query is not a scheduled task and should not change your notes. It only gives the agent information to consider.

## Safe setup

1. Ask Chatobby to create the query disabled.
2. Give it a clear name and plain-language description.
3. Test it and inspect the returned information.
4. Keep the result short; every enabled result becomes part of the agent’s working context.
5. Enable it only when you trust its source and output.

> Create a disabled session-start query named “Current sprint.” It should return only the sprint name, end date, and source. Test it, but do not enable it.

## Choose the right feature

- Permanent project rule: \`.chatobby.md\`
- Relevant fact or preference: Memory
- Current computed value: Context query
- Work that should happen later or repeatedly: Event

[[00 - Start Here|Guide index]] · [[03 - Memory and instructions|Memory choices]] · [[08 - Examples and recipes|See examples]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/06 - Plugins and MCP services.md`,
    title: "Plugins and MCP services",
    content: `# Plugins and MCP services

Plugins extend what Chatobby can do. An MCP service can connect Chatobby to tools such as GitHub, a calendar, communication apps, cloud files, or another local program.

Installing, connecting, and granting permission are separate steps. This separation keeps a newly added service from becoming available to every agent automatically.

## Connect a plugin

1. Open **Plugins** from the Chatobby ribbon.
2. Search the catalogue or add a custom MCP connection.
3. Open the plugin page and review its publisher, source, connection type, and requested access.
4. Add it. Catalogue plugins are added disabled so you can review them first.
5. Complete Authentication if needed.
6. Enable and connect the plugin.
7. Refresh its tools.
8. Open [[02 - Permissions and safety|Permissions]] and allow only the capabilities the intended policy needs.

## Access tokens: secret name versus secret value

When a plugin asks for an access token, Obsidian stores the private token. Chatobby stores only the name of the Obsidian secret that points to it.

- **Secret name or ID**: a safe label, such as \`github-token\`.
- **Secret value**: the actual private token copied from the service.

Creating a secret does not automatically link it to a plugin. After creating it, return to the plugin’s **Authentication** section and select that secret under **Saved access token**. The page should say which secret is linked before you choose Connect.

Never paste an API key or token into a Chatobby message or ordinary note.

## Why a connected plugin may show no tools

Check these in order:

1. The plugin is enabled.
2. Authentication is complete and the correct saved token is linked.
3. Connection diagnostics report success.
4. **Refresh tools** has completed.
5. The active permission policy allows that plugin’s tools.

A plugin can be healthy but unavailable to the agent because its policy denies it. That is expected.

## Which account sign-ins work?

Chatobby currently supports standard MCP OAuth, one bearer token stored through Obsidian Secrets, no-auth servers, and local environment-variable setup. The brand shown in the catalogue does not by itself mean that Chatobby has a custom one-click login for that company.

Services that require a pre-registered OAuth client, several secrets, a special API-key header, device-code login, or another vendor-specific flow may need additional setup or may not yet be supported by the Plugins page. Read the plugin's setup details before adding it.

## Choose services carefully

Catalogue presence is not a safety endorsement. Prefer first-party publishers, review the source link and requested access, and remove services you no longer use. Local MCP plugins run programs under your computer account; remote plugins send requests to another service.

## Ask Chatobby for help

> Help me connect the official GitHub MCP plugin. Explain what credential it needs, stop before creating or changing a token, and show me which permission group I should review after connection.

Chatobby can guide setup, but it should never reveal private internal tool instructions or ask you to paste a secret into chat.

[[00 - Start Here|Guide index]] · [[02 - Permissions and safety|Control plugin tools]] · [[09 - Troubleshooting and limits|Connection troubleshooting]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/07 - Models and providers.md`,
    title: "Models and providers",
    content: `# Models and providers

A provider is the company or service that supplies the AI model. The model is the particular AI you choose for a session. Chatobby uses your own provider account or API key.

## First-time setup

Open Chatobby settings, choose a provider, and follow its credential instructions. Ordinary setup should not require editing configuration files. Keep keys in the provided secure fields; never put them in a note or message.

The controls below the composer apply to the current session:

- **Provider** chooses the service.
- **Model** chooses a compatible model from that provider.
- **Effort** controls how much reasoning the model should spend when supported.

When you switch providers, Chatobby should also choose a compatible model rather than leaving an invalid selection.

## Which model should you choose?

- Use a fast, lower-cost model for short questions, simple rewriting, and routine note cleanup.
- Use a stronger reasoning or coding model for multi-step work, difficult research, or changes across many files.
- Increase effort when extra checking is valuable, not automatically for every message.
- Choose a model with image support when you attach screenshots or photos.

Example for a lighter model:

> Turn this note into a concise checklist. Preserve every date and link.

Example for a stronger model:

> Compare these project notes, identify contradictions, research any current claims, propose a resolution, and wait for approval before editing.

## Costs and limits

Pricing, context limits, rate limits, retention, and data handling come from your provider. Chatobby cannot override them. Long conversations, large tool results, many subagents, and repeated context can increase usage.

If a response stops unexpectedly, check provider status, available credit, rate limits, model availability, and Chatobby runtime diagnostics before repeatedly retrying.

[[00 - Start Here|Guide index]] · [[01 - Sessions and vault work|Start a session]] · [[09 - Troubleshooting and limits|Troubleshoot failures]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/08 - Examples and recipes.md`,
    title: "Examples and recipes",
    content: `# Examples and recipes

These examples are starting points. Replace folder and note names with your own.

## Explore before editing

> Search \`Finance\` for notes related to tax filing. Summarize the relevant files, explain what appears missing, and cite the note paths. Do not edit anything.

## Make one checked note change

> Update \`Projects/Move/Plan.md\` with the decisions from today’s note. Preserve frontmatter and links. Reopen the rendered note and report any errors.

## Research current information

> Research the current official requirements for this topic. Prefer primary sources, include dates and links, stop once the answer is well supported, and clearly label any inference.

## Use subagents without losing control

> Launch one vault researcher for my existing notes and one web researcher for current official sources. Give both the read-only research policy. Ask them to send concise findings through the project channel, then combine the results. Stop both when they finish.

## Teach a lasting preference

> Remember at vault scope that when I ask to “add this to my calendar,” you should use \`Calendar/Inbox.md\` unless I name another calendar. Ask before replacing an existing entry.

## Add a project rule

> Draft a short \`.chatobby.md\` for this folder. Require YYYY-MM-DD dates, preserve quoted text, and verify Dataview blocks after edits. Show me the draft before saving.

## Schedule a weekly review

> Create a disabled weekly event for this project. Every Friday at 4 PM, open a session that reviews overdue tasks and suggests next steps. Use the read-only review policy and show me the event before enabling it.

## Add a small piece of live context

> Create a disabled session-start query named “Current sprint.” Return only the sprint name, end date, and source. Test it and show me the result, but do not enable it.

## Connect a plugin carefully

> Help me connect the official GitHub MCP plugin. Explain each step in plain language. Do not ask me to paste a token into chat. After it connects, show me which GitHub capability group is still denied.

## Ask for a plan only

> Review this project and make a five-step implementation plan with risks and verification. Do not edit files, change settings, launch subagents, or contact external services.

[[00 - Start Here|Guide index]] · [[04 - Subagents tasks and channels|Understand agent teamwork]] · [[06 - Plugins and MCP services|Connect services]]
`,
  },
  {
    path: `${CHATOBBY_GUIDE_DIRECTORY}/09 - Troubleshooting and limits.md`,
    title: "Troubleshooting and limits",
    content: `# Troubleshooting and limits

Most problems fall into one of four areas: the Chatobby runtime, the chosen model provider, permissions, or a connected plugin.

## First checks

1. If work is stuck, press Stop once and wait for the state to settle.
2. Check the provider, model, project directory, and policy shown below the composer.
3. Open the relevant page and read its visible status.
4. Use **Copy diagnostics** when the runtime or plugin offers it.
5. Retry once after addressing the likely cause.

## A plugin says its bearer token is unavailable

The token may exist in Obsidian without being linked to that plugin.

1. Open the plugin’s page.
2. Find **Authentication**.
3. Under **Saved access token**, select the existing secret name.
4. Confirm the page says it is linked.
5. Choose Connect again.

If the linked secret has no saved value, update that secret in Obsidian and select it again. See [[06 - Plugins and MCP services|Plugins and MCP services]] for the difference between a secret name and its private value.

## A connected plugin has no usable tools

Confirm that it is enabled, authenticated, connected, and has refreshed its tools. Then open Permissions and check the section named for that plugin. Newly discovered plugin tools start denied.

## A page looks out of date

Wait for Chatobby to reconnect, then use that page’s refresh action once. Record which action should have appeared live. Repeatedly leaving and reopening a page should not be required.

## A permission appears to be ignored

Confirm that you assigned the edited policy to **Main agent** rather than only selecting it for editing. Test a new tool call; a call already in progress may have started under the previous decision. If a denied action still succeeds, stop the session and report it as a security bug.

## A turn or subagent does not stop

Use Stop once. The timer, composer button, and running state should all settle. If they do not, copy diagnostics and include which agent, tool, or compaction step was active.

## Obsidian becomes slow or reloads

Stop active Chatobby work, close unnecessary views, and restart Obsidian once. Include the open Chatobby page, approximate response size, and last visible action in a report. Do not repeatedly restart a crashing runtime without collecting diagnostics.

## Protect private information

Do not share API keys, access tokens, full private prompts, or unrelated vault contents in public bug reports. Redact personal paths where they are not needed.

AI models, websites, and third-party tools can be wrong. Verify high-impact medical, legal, financial, security, and destructive actions independently.

[[00 - Start Here|Guide index]] · [[02 - Permissions and safety|Review permissions]] · [[06 - Plugins and MCP services|Review plugin setup]]
`,
  },
];
