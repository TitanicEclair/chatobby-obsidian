# Contributing to Chatobby

Chatobby is in public alpha. Bug reports, reproducible test cases, documentation corrections, and focused connector improvements are welcome.

## Before opening an issue

- Search the [issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues) for an existing report.
- Use [GitHub Discussions](https://github.com/TitanicEclair/chatobby-obsidian/discussions) for questions, ideas, and general feedback.
- Do not post provider keys, vault contents, runtime tokens, private paths, or other secrets.
- Report security concerns privately as described in [SECURITY.md](SECURITY.md).

For a bug, include the Chatobby plugin version, runtime version, operating system, Obsidian version, expected behavior, actual behavior, and the smallest safe reproduction you can provide.

## Proposing a connector change

1. Open an issue or discussion before beginning a large change.
2. Keep changes focused and preserve the connector/runtime security boundary.
3. Add or update focused tests for changed behavior.
4. Run the repository checks described in the development documentation.
5. Open a pull request that explains the user-facing effect, verification performed, and any remaining limitation.

The repository is source-available, not open source. Contributions and forks remain subject to [LICENSE](LICENSE), including its contribution terms and redistribution restrictions.

## Scope

This repository contains the reviewable Obsidian connector. The separately distributed Chatobby runtime is closed source. Issues may describe runtime-visible behavior, but runtime source is not accepted through this repository.
