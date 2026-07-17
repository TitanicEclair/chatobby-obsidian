# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately to thatsmad002@gmail.com with
the subject `Chatobby security`. Do not include provider keys, vault contents,
private signing keys, or other secrets. Include the connector version, runtime
version, operating system, impact, and minimal reproduction details.

Please do not open a public issue for an unpatched vulnerability. A report will
normally be acknowledged within 7 days. Validation, remediation, and disclosure
timing depend on severity and reproducibility.

## Security boundary

The connector authenticates a local loopback runtime, verifies signed managed
runtime packages, validates a public protocol, and exposes only allowlisted
Obsidian operations. The connector does not accept arbitrary JavaScript,
arbitrary Obsidian method names, generic shell commands, or unsigned managed
runtime packages through that bridge.

Model providers, websites, community plugins, user-installed tools, and the
operating system remain outside Chatobby's security boundary. Users should
keep Obsidian, Chatobby, and provider credentials current and should back up a
vault before enabling write-capable agent workflows.

Only connector releases published through Obsidian and runtime packages,
installers, signed update descriptors, and checksums published at
`https://github.com/TitanicEclair/chatobby-runtime/releases` should be trusted.
Signing keys and security reports must never be committed to the connector
repository.
