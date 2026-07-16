# Connector Release Boundary

> Status: signed runtime and reviewable connector candidate verified; public
> distribution gates remain
>
> Last verified: 2026-07-16

## Enforced now

- `boundary-manifest.json` classifies every top-level connector source file and
  directory, records its authority, excludes local state, and lists private
  runtime packages that connector source may not import.
- `npm run check:release-boundary` fails when a new source root is unclassified,
  a private runtime package is imported, a source path is a symlink, or the
  official asset set changes.
- `npm run build:release` compiles with the `release` build constant, disables
  source maps, minifies JavaScript and CSS, and writes only `main.js`,
  `manifest.json`, and `styles.css` under `release/`.
- The release artifact verifier rejects extra files, source-map markers, known
  development paths, user-profile paths, signing-key configuration, private-key
  material, and common provider/service token formats.
- Managed runtime resolution in a release bundle accepts only the
  installer-owned current runtime path. Environment overrides, plugin-bundled
  executables, and `PATH` fallback remain development-only.
- Release builds require an embedded Ed25519 runtime public key. Every managed
  launch re-verifies the signed package manifest, platform, protocol, plugin
  compatibility, executable, MCP UI bridge, and parser WASM files.
- `data.json` and `release/` are ignored and cannot enter the official release
  directory produced by the release command.

## Build behavior

| Behavior | Development build | Release build |
|---|---|---|
| Output | Live plugin root | `release/` staging directory |
| Source map | Inline | Disabled |
| Minification | Disabled | Enabled |
| Managed runtime override | Environment, bundled, installed, then `PATH` | Installed pointer only |
| Boundary scan | Available through checks | Required by build command |
| Official assets | Not constrained | Exactly three files |

## Current candidate

The backend builds a current-source Node SEA executable and packages it
with a complete signed inventory, checksums, an SPDX SBOM, third-party notices,
license texts, provenance, and required runtime assets. The connector embeds
the matching public key, rejects extra files and symlinks, and repeats complete
package verification before launch. A clean reviewable-source export rebuilds
the same release `main.js` byte for byte.

The signed package contains 92 components and passed the artifact scan with no
gaps, failures, or warnings. Its runtime package fingerprint is
`2ec726d17779301f9ef87160ef25ddbe4c66f5d5395481446e905c9bc572c599`.
Live Obsidian CLI acceptance proved authenticated replacement after a package
change. An existing session rendered five durable Thought blocks and three
completed tool calls. All five feature pages populated on their first
navigation click, direct state hydration restored Events, Back/Forward
traversed Events to Memory and forward to Events, and a real prompt completed
without a stuck working state or captured error.

The final connector release files are:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `main.js` | 501,708 | `1237480c5a0ef634084fe22f9a95a51807a94da4b285e834d9f085e7c4914a3e` |
| `manifest.json` | 229 | `bc9563e9eb135325990023fb797cd119ae0b8cb1a8451b8d5234251e35b2d97a` |
| `styles.css` | 138,471 | `8c40cecd04152af590d9bfa883ed0920a94e598260fc85fa06a7a9471524df15` |

The clean reviewable export has no missing publication files, installs with
zero reported npm vulnerabilities, and reproduces all three assets byte for
byte.

Windows installer staging validates the runtime, connector, and key before
compilation. The resulting
`Chatobby-0.1.0-private-alpha-win-x64.exe` is 26,949,083 bytes with SHA-256
`701190c74d3491cf0d1a781a3a5cef6b4a54cd308bbdc5913faeedfb092d058d`.
The connector remains the minimal three-file Obsidian boundary and may be
installed privately without Community-plugin publication.

## Remaining production blockers

Public production distribution remains blocked until:

- the Windows installer is Authenticode signed; it currently reports
  `NotSigned`;
- the runtime signing key is rotated because its private material was exposed
  in a local build transcript;
- an Inno Setup license suitable for commercial distribution is used before a
  paid release; the current compiler identifies itself as non-commercial-use;
- install, upgrade, rollback, and uninstall are exercised on a clean Windows
  machine;
- the reviewable connector is published in its intentional public repository;
- Obsidian disclosures/pre-clearance are completed for the separately installed
  closed-source runtime and loopback/network behavior;
- the private-evaluation and future commercial terms receive qualified legal
  review.

The current artifacts are suitable for controlled private evaluation, not an
unqualified public or paid production release.
