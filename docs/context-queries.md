# Context Queries guide

Context Queries let a project supply a small piece of current, typed data to
Chatobby automatically. They are useful when the information should be
calculated at session start or immediately before each user turn rather than
stored as memory.

You do not need to install Node.js, inspect Chatobby's source code, or understand
the runtime implementation. The installed Chatobby runtime owns the bounded
worker and the contract documented below is the complete supported interface.

## When to use a query

Good uses include:

- the current Git branch and changed-file count;
- a small project status object from a local JSON file;
- selected frontmatter from a known project note;
- a bounded response from an approved HTTP endpoint;
- a value that genuinely changes between adjacent turns.

Do not use a query for secrets, permission rules, instructions, ordinary note
search, large documents, or a large collection of data. Use **session start** by
default. Choose **every turn** only when the value can change often enough to
justify running code before every message.

## The easiest way to create one

Ask Chatobby for the outcome and keep the query disabled until you have reviewed
its test result:

> Create a disabled session-start Context Query named Repository status. It
> should return the current Git branch and changed-file count. Test it with the
> current project, show me the result, and do not enable it yet.

Chatobby should use the dedicated Context Query tools. It must not search its
own plugin, runtime, private source, bundles, source maps, or development
checkout to discover how queries work. If a supported tool or this documented
contract is insufficient, that is a product gap to report rather than a reason
to reverse-engineer Chatobby.

The Queries page shows each query's name, description, timing, enabled state,
and latest test result. The page intentionally does not turn normal usage into
a code editor. User-authored source is kept in the project under
`.chatobby/queries/scripts/<query>/main.mjs` and can be inspected through the
dedicated read tool when needed.

## Safe lifecycle

1. **List** the project's queries before creating a duplicate.
2. **Create** a disabled query with a clear name, description, trigger, and
   complete initial script.
3. **Read** an existing query before changing it.
4. **Update** the complete script using its current revision. An edit disables
   the query and clears its previous approval.
5. **Test** the exact revision. Testing does not inject the result into a
   session and requires visible user confirmation.
6. **Review** the returned data and any error.
7. **Enable** only after that exact source has tested successfully and you
   personally confirm that it may run.
8. **Disable** it when automatic injection is no longer useful. Permanently
   delete it only when you explicitly want its definition and script removed.

The runtime remembers the successful test across reconnects. Editing the script
outside Chatobby changes its hash, disables it, and requires another test before
it can be enabled.

## Script contract

Every `main.mjs` must default-export one function with this shape:

```js
export default async function query(context, sdk) {
  return {
    schemaVersion: 1,
    format: "json",
    label: "Repository status",
    data: { branch: "main", changedFiles: 0 },
  };
}
```

`context` contains only the supported turn information:

```ts
{
  project: { directory: string; queryDirectory: string };
  session: { id: string; name?: string; isNew: boolean };
  turn: { userMessage: string; sentAt: string };
  environment: {
    localDate: string;
    timeZone: string;
    locale: string;
    platform: string;
  };
}
```

The bounded SDK provides:

```ts
sdk.files.list(relativeDirectory, { limit? })
sdk.files.readText(relativePath, { maxBytes? })
sdk.files.readJson(relativePath, { maxBytes? })
sdk.markdown.readFrontmatter(relativePath)
sdk.http.fetchText(url, { timeoutMs?, maxBytes? })
sdk.http.fetchJson(url, { timeoutMs?, maxBytes? })
```

SDK file paths are relative to the selected project and cannot escape it. Node
built-ins, relative local modules, and global `fetch` are available, but
external packages are not guaranteed. Prefer the SDK because its bounds and
intent are clearer.

Return exactly one finite JSON-compatible result:

```ts
{
  schemaVersion: 1;
  format: "text" | "json" | "items";
  data: string | JsonValue | JsonValue[];
  label?: string;
}
```

`text` requires a string. `items` requires an array. Results cannot contain
cycles, functions, symbols, `undefined`, or `bigint`.

## Limits and trust

- source: 64 KB per query;
- execution: 2 seconds;
- result: 24 KB per query;
- combined injected query data: 48 KB per turn.

The worker is process-isolated but is not a security sandbox. Query code is
trusted project code and can use the operating-system authority of the
Chatobby runtime. This is why testing and enabling require confirmation.

Query results enter the model context as untrusted reference data. A result can
provide facts, but it cannot become system guidance, grant permission, or
override the user's request.

## Troubleshooting

- **The Enable action is rejected:** test the current source successfully
  first. A previous revision's test does not approve an edited script.
- **A query disabled itself:** the source changed outside Chatobby or its saved
  test no longer matches the current hash.
- **The query timed out:** reduce filesystem work, network work, and returned
  data. Queries are intentionally small and fast.
- **A module cannot be found:** avoid third-party packages; use the SDK, Node
  built-ins, or a relative module stored beside your own query.
- **The result is not injected:** verify the query is enabled, its trigger is
  correct, and its most recent run did not fail or exceed a limit.
