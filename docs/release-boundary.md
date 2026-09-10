# Connector release boundary

> Current public-alpha distribution: Obsidian Community plugin plus the
> plugin-managed, Ed25519-verified Chatobby runtime.

For 0.5.3, sandboxing is temporarily unavailable. The runtime package deliberately
omits native sandbox executables and qualification assets. Full-access tool,
restart, Stop and exact-pair installation checks replace native qualification
for this execution mode. Signatures, platform compatibility, legal inventories,
rollback and public projection gates continue to apply.

## Reviewable connector

The public connector is intentionally limited to Obsidian presentation,
workspace integration, transport, and verified runtime lifecycle handling.
`boundary-manifest.json` classifies every public source root and prevents the
connector from importing private runtime packages.

`npm run build:release`:

- compiles with release-only constants;
- disables source maps;
- minifies JavaScript and CSS;
- requires the runtime Ed25519 public key;
- rejects local paths, private-key material, common credentials, and unexpected
  files; and
- emits exactly `main.js`, `manifest.json`, and `styles.css` in `release/`.

Release-mode runtime discovery accepts only the installed runtime pointer. The
environment, plugin-bundled executable, and `PATH` fallbacks are development
features and are not present in the Community plugin path.

The reviewable export includes the exact lint, storage-policy, documentation
projection and release-workflow configuration referenced by its package scripts.
A fresh export must build with locked dependencies without copying extra files
manually from the private checkout. The export regression checks those inputs
alongside the documentation link closure; a fresh release build proves them
together before public projection.

## Runtime trust boundary

The private runtime is published separately as a versioned compressed bundle.
Connector version `N` resolves only
`releases/download/N/runtime-index.json`; it never uses `releases/latest`.
The connector verifies the signed release descriptor, complete signed package
manifest, platform, architecture, protocol, plugin compatibility, inventory,
file sizes, and SHA-256 hashes before activating it. Updates install into a
new version directory and switch the current pointer only after verification.

The connector's schema-2 installation journal records acceptance before backup
cleanup. A restart can finish a partially removed backup after revalidating the
active signed package and authenticated runtime identity. Legacy prepared and
activated journals remain readable; cleanup must finish before downgrading to
an older connector. See [Managed runtime lifecycle](architecture/managed-runtime-lifecycle.md)
for the persistent-state migration and rollback boundary. Candidate acceptance
includes same-version replacement and plugin restart, in addition to clean
installation and distinct-version rollback.

The same signed exact-version index names `chatobby-guide-N.json` with its
product version, independent guide revision, byte size, SHA-256 hash, and file
count. The connector verifies those values and the bounded unique
`Chatobby Guide/*.md` file set before showing the existing write confirmation.
Guide Markdown is an ordinary source-owned release asset: it is not bundled
into connector `main.js` or the runtime executable, and there is no embedded
fallback or `latest` guide lookup.

The Ed25519 package signature proves that the runtime package came from the
Chatobby release key and was not modified. It does not suppress the Windows
publisher warning that applies to directly launched, unsigned executables;
that requires a separate Authenticode certificate.

## Build modes

| Mode | Intended use | Runtime | Connector |
|---|---|---|---|
| Development | Local source work | Source or locally built binary | Unminified local build |
| Release candidate | Exact pre-publication verification | Public-alpha package | Production connector build |
| Public alpha | Current official path | Ed25519-signed package | Community plugin assets |
| Stable signed | Future stable/paid distribution | Ed25519 + Authenticode | Community plugin assets |

Standalone and runtime-only installer tooling remains available for controlled
testing, but installers are not part of the current official public-alpha
release. Users install the plugin through Obsidian and install or update the
runtime from Chatobby's in-plugin action.

The connector has an explicit release-build capability for one-action runtime
provisioning after plugin enable/layout readiness. It is off by default and the
public workflow does not set
`CHATOBBY_OBSIDIAN_APPROVED_AUTOMATIC_RUNTIME_PROVISIONING=1`. Turning it on
requires both the canonical
runtime maintenance-admission contract and written Obsidian approval for the
connector to install/update its separately distributed closed-source runtime.
Disclosure alone is not authorization. If approval is declined, the Community
build retains the explicit in-plugin action; automatic builds may be distributed
only through a separately authorized channel.

## Release requirements

The 0.5.2 follow-up consumes source `c1ef7737bce0e76a05168bda6af30963a7af3c7e`.
Generated browser code and contracts are unchanged; projection receipts now bind
Windows file-metadata, Linux process prerequisites, concurrent startup and
actionable child-failure corrections. Local Windows native tests pass 40 cases;
local Linux qualification passes seven native and ten application bootstrap
cases. Both compiled packages pass 18 actual tool calls over first startup and
restart. The earlier failed candidates remain excluded. Exact paired installation,
fresh hosted qualification and signed-candidate acceptance remain required.
Installed testing also exposed a connector restart racing an in-flight startup.
Stop now drains that cancelled attempt before reporting completion; deferred
connection and owned-process regressions exercise the failure before packaging.
The fresh backend comparison passed; two local projection tests then caught
stale pinned test receipts. Their receipts were refreshed, and the tests now
compare the accepted commit to the generated manifest rather than a second
source-commit literal. Exact file hashes and fresh-backend comparison remain gates.

Hosted builds are manual final production checks, after local source/connector,
native and affected disposable-vault UI acceptance. Push/PR build triggers are
removed; `local_acceptance_complete` defaults to false. Optional final live
runner acceptance has its own explicit input. No iterative candidate dispatch
is required for development installation. The source-owned
`packages/chatobby/docs/devops/actions-budget-policy.md` records the budget
policy, measured audit and remaining Windows Server diagnostic boundary.

### September 9 post-release boundary correction

SEARCH-051 advances the development source to
`c3a354aab65b3101c6e73e25f1b88a799b27179e`. It improves default DuckDuckGo
queries, region preferences, site filters, actual continuation, retained results,
paced requests and agent guidance. The generated connector changes provenance
only; browser contracts and code remain byte-identical. Source acceptance has
89 core web-tool tests, 43 contract tests, 2,165 runtime tests (one skip), passing
root checks and 40 real Windows native tests. Exact backend comparison and
disposable-vault adoption remain installation gates. No new public release is
implied; the preceding source checkpoint below remains historical evidence.

The BOUNDARY-051 checkpoint consumes source `46255327a1cf824ec3b6d9c3654b7e5cc7333d59`.
The first installed b64c40a3d checkpoint passed tool execution but Computer Use
found new workspace pages failed after restoring Obsidian app access Off.
The source transport mistook an externally stopped MCP operation for incomplete
cleanup even when its native receipt proved completion. New early regressions
separate these outcomes while preserving missing-receipt rejection. This intake
adds that correction; the first checkpoint is not final acceptance.
The generated client and protocol receipt refresh changes provenance only;
browser code and wire contracts are byte-identical. The source fixes native
host-path capture, permission-driven tool exposure and MCP/CLI error reporting.
Its 40 committed-source Windows native cases pass. This pair still requires
development installation and live acceptance; it is not a new public release.
Run the exact backend comparison before reconciliation so receipt drift fails
before executable compilation. This check caught two stale source-SHA literals
in projection tests after their receipts had been refreshed; both are updated
to the verified generator revision. The acceptance records below are historical.

### September 9 local acceptance

The installed development runtime uses source
`764f1c5a7ec58a913f1072f7f4611eede5c545c7` and executable SHA-256
`8e40b65ef6bfdbb0fbab294f02d1dbd3194cdb76ed36ad056971a1a005b44184`.
Its root checks, 2,140 runtime tests (one existing skip) and 40 real Windows native
cases pass. Installed Workspace On, Read-only On, Workspace Off and ordinary Full
On each pass seven actual shell/file/network probes. The Permissions page now
uses the execution backend's packaged support, covered from qualification through
frontend projection before compilation. No device self-test is added.

Local Computer Use covers Permissions, Events editor, Memory filters, local model
discovery and Channels. It found a long participant-label clipping defect under
Obsidian button defaults and deferred background tab titles after plugin reload;
both now have early connector regression coverage. Sidebar collapse/expand retains
216px scroll and the same mounted list. Connector-only fixes reuse the identical
runtime bytes. Exact pair, installation, screenshots, failures and final lifecycle
receipts live under
`C:/chatobby/evidence/sandbox-unification-20260908/final-local-acceptance`.

This is a locally installed development pair, not a signed five-platform production
candidate. Final Windows Server PowerShell 5.1 qualification remains unproved and
the hosted budget prevents final assembly. No new Actions jobs, public tags,
publication or main-branch promotion are authorized by these receipts. All prior
candidate receipts below are historical and must not be relabeled or mixed.

### Earlier Windows Vault checkpoints

The earlier Windows Vault checkpoint consumes source
`b6bb4a5230ec5c42c9147359877b761575b4a240`. The controlled Windows native executable
preserves Vault/Project access around protected storage and reports owned cleanup
through a private per-invocation record. Its complete modified LGPL source,
original source/dependencies and native build evidence accompany the package.
Full remains the ordinary host path with Network On, as the owner clarified.

Local source checks, 2,138 product tests (one skip), 504 sandbox tests and all
40 actual Windows native cases pass. Native qualification is produced during
development/release validation; no installation or startup capability test runs.
The exact five-platform candidate and installed Computer Use remain required.
The paired connector passes exact backend comparison, all 1,196 tests (two
existing skips), repository checks and the Community-review development build.
Candidate 34263412522 stopped in early platform integration tests: one POSIX
collector assertion used the Windows layout, and two Windows/macOS file-admission
fixtures used unresolved temp aliases. This source checkpoint fixes both test
fixtures; 63 focused cases pass normally and through an explicit directory alias.
Native and product implementation bytes are unchanged by that fixture correction.
The final source also corrects three native skill resources still describing
Project-only Windows admission or user verification. All 174 agent package tests
and the source root check/build pass; skill IDs and routing remain stable.
Pre-installation Computer Use found two stale Settings descriptions: Git Bash as
the automatic Windows shell and mandatory manual local model IDs. Both now match
PowerShell Auto and server discovery, with rendered Settings regression coverage.
Candidate 34265454675 was cancelled before installation to include this connector
correction in the exact final pair. A local release build also correctly rejected
an omitted public verification key; supplying the verified public key passed.
The source also corrects the native fixture compiler path to the complete acquired
MinGW distribution. All 40 native cases pass locally with PowerShell 7.6.5 and 5.1;
both workflow paths have early regression coverage. Runtime/native product bytes
are unchanged by the CI and acceptance-document corrections.
The following candidate 34266651015 passed its first native targets but package
staging rejected a missing source revision. The source workflow now supplies its
immutable revision at target-job scope, with early contract coverage. Native
qualification remains mandatory and source-bound; no staging guard was weakened.
Candidate 34267581930 passed all four Linux/macOS native and package jobs, but
Windows repeated the PowerShell 5.1 timeout and its evidence upload crossed two
volumes. The final source canonicalizes the native fixture under RUNNER_TEMP,
retains shell startup/stdin/Stop diagnostics and bounds the native CI step. An
actual 8.3-path reproduction fails with provider access denied; the canonical
fixture passes all 40 cases with both existing PowerShell editions. Shell
workspace failures now include a reason. The full source suite passes 2,138
tests with one skip; its check and build pass. These changes do not alter browser
contract bytes. Diagnostic job 34268854032 could not start because GitHub's
Actions budget prevents further use. Windows CI, candidate assembly, exact
installation and final Computer Use remain pending; no new candidate is installed.
The following qualification-only checkpoint is historical.

The 2026-09-09 qualification checkpoint consumes source
`62c89011b78643b5a859db0eab522257657af256`. The generated asset allowlist accepts
one non-executable `qualification.json` beside each matching Landstrip target.
The active runtime reads it from its authenticated package instead of running
startup/device self-tests. Existing inventories remain readable for rollback.
Native candidate checks now precede executable compilation and packaging.

This is an incomplete sandbox redesign, not an accepted candidate. The isolated
Windows experiment passes 37 native cases but Full policy still fails; the
shipping native identity and Windows Vault admission guard remain unchanged.
The experiment cannot produce release qualification. Native production/legal
integration, Full-mode implementation, five-target candidate, exact installation
and Computer Use are still required. No newly installed behavior is claimed.

The first full connector run caught two stale source-projection test receipts.
The reviewed receipt hashes now name the new source. `check:backend-contract`
also runs those exact-receipt tests immediately after generation comparison so
future mismatches fail before the full build or installation.

This checkpoint passes all 1,196 connector tests with two existing skips,
connector checks, exact backend comparison and the Community-review development
build. These are source/build results; the installed candidate remains unchanged.

The following exact-pair records are historical.

The 2026-09-08 follow-up consumes source
`a3ee0827f8b3d020378a1201f0b0ea8c275ab281`. It adds automatic installation-owned
workspace checks, Vault Event option compatibility and a combined Knowledge
memory filter. The connector removes the normal manual verification checklist,
redundant memory scope control, app-access subtitles and second folder modal;
Channel date and participant styles are corrected. The network toggle stays in
the composer. Vault app access defaults On while explicit Off remains Off.
Historical verification evidence remains in protected runtime storage, outside
normal UI. Existing exact-pair receipts below are historical, not acceptance of
this pair. The runtime also fixes the installed startup race where a Project
refresh cancelled the device check. A fresh complete candidate and installed
Computer Use pass are required.

The previous generated projection baseline is source
`9ed5afbe5a6ec1a2464513e0a9540f504d3f4760`. This bounded intake refreshes
provenance for saved-policy binding/reopen and Windows Project shell-directory
corrections, without changing browser contracts or connector behavior. Source
joint tests pass 98 cases, the root gate passes in 41.619s and affected product
compilation passes in 5.227s. The preceding exact 246d434/8c96ccd pair passed
installed native Verify and A/B isolation, but exposed those two main-path bugs.
Its immutable receipts remain historical; this corrected pair requires its own
normal reconciliation and targeted reopen/actual-cwd acceptance. The existing
17-case Verify includes the cwd assertion in its startup case, not a new matrix.

The preceding generated projection baseline was source
`246d434938d65441e55eccd5eabd12e073342175`. Durable session-owned mode and
network now project through the existing controls: independent chats do not
change siblings, the same durable chat shares its canonical settings across
tabs and reopen, and parent-controlled child views cannot override their owner.
New independent chats start Workspace/On; existing chats preserve their actual
prior policy once. Vault app grants retain their separate revision and authority,
and Full still requires Network On. Late loads and mutation responses cannot
overwrite a replacement session's state or notices. No connector policy store,
Project setting, Auto mode or public activation was added.

Historical interrupted Landstrip verification is retained as exact archived
evidence with an explicit cleanup-unproved warning, including after later fresh
success. Current maintenance, active cancellation, installation identity and
fresh verification gates remain required; this warning is not native readiness.
The previous installed pair51 remains unchanged at this checkpoint, including
its incomplete revision-6 attempt. New exact-pair installation, session A/B and
reopen acceptance, and explicit installed Verify are pending; no old residue was
repaired or relabeled as clean.

Source's fresh complete product suite passes 1,966 tests with one existing skip;
the final test-only registry correction passes all 227 DevOps tests and the root
check (62.323s), with production bytes identical to source291034. The connector
complete suite passes 1,137 tests with two existing skips (23.438s), complete
checks pass (17.718s), and Community-review development build passes (66.965s).
Two earlier full-suite failures were stale exact-projection receipts, corrected
without weakening comparisons. Final generation took 0.622s and only refreshed
provenance after that test-only source correction. Independent check/test/build
commands overlapped; these durations are not additive elapsed time. Remote CI
still gates integration, not otherwise admitted local development acceptance.

The preceding generated projection baseline was source
`0343c1dfeeef9b0c194a42a6b9757f7bb3081b59`. The existing composer now projects
Read-only/Workspace/Full from the canonical installation-wide policy; its shield
icon/order/layout are unchanged. Selection loads the current policy revision and
network choice, uses the existing policy CAS intent, guards changed session/view/
runtime identity and waits for acknowledgment. It does not persist a preference,
restore legacy profiles/Auto, change vault/MCP switches or add a store/schema.
Source dependency/root gates and105 affected tests pass;27 focused connector
tests cover the exact mode/network combinations and stale/pending/error behavior.
The narrow handler lives in `composer-access-policy.ts`, keeping the existing
view-size ceiling unchanged. Final exact comparison passes (1.129s), complete
checks pass (16.161s), all1,107 tests pass with two intentional skips (27.101s),
and the Community-review development build passes (37.263s). Generation took
0.639s. Check/test/build commands overlapped; their durations are not additive.
Normal reconciliation of this exact new pair follows; installed Verify remains
a separate explicit action on its resulting fingerprint.

The preceding f3cd/726e789 pair was installed as exact pair9b1f through normal
reconcile in86.928s. Independent114-file runtime/three-plugin-artifact verification
has zero mismatches; all27 user-note files and saved settings are unchanged.
Initial ordinary task-plan/turn Stop/follow-up and same-profile history reopen
pass. The isolated test launcher omitted ProgramData/ProgramFiles; one reviewed
normal same-profile resume restored those OS-derived values without changing
product checks, settings, registry or installed bytes. Verify is now available,
but ready remains false and no Verify ran. The imminent new composer fingerprint
gets its own installed Verify and targeted UAT; prior evidence is not relabeled.

The preceding generated projection baseline is source
`f3cd4a1d11911d92c013b14c88e585323a82799b`. The bounded product checkpoint
`5e03df146f9bbb720897c23e537f865fbd29a99f` forwards the captured Windows
Stop port through installed Verify, selects exact-image eligible payloads, and
uses fish's EOF syntax while preserving sh/bash/zsh/PowerShell probes. The final
source head adds isolated portable CI groups only. Intake updates provenance,
not browser contracts or permission controls. Fresh local pairing gates precede
normal development reconciliation; hosted CI still gates integration.
This exact intake passes backend comparison (1.105s), complete connector checks
(19.386s), 1,092 tests with two intentional skips (29.797s), and the development
build including Community-review checks (63.466s). Generation took0.677s.
Checks/tests overlapped; these command timings are not additive wall time.
They do not establish installed acceptance. The source PR's first isolated
matrix passes all20 suites at its distinct merge revision, not a replacement
for the exact local source artifact identity.

The preceding `cff8e8f82c09767e5325db7c23995b411fe04d92` S5 checkpoint connects
packaged Landstrip, captured PS7/POSIX prerequisites and explicit installed
Verify/readSupport. The connector consumes its additive Landstrip backend and
per-launch `not-required` setup state without a grant/readiness invention.
The normal typed projection now also contains the exact finite Cargo dependency
source inventory; this does not certify target-runtime redistribution rights.
Source tests/build/checks pass, including 948 combined tests (10 existing skips),
22 explicit packet mocks and 43 tool-contract tests. The bounded Windows Stop
fix uses captured PS7 to terminate only the verified payload, leaving the upstream
launcher to perform cleanup. Compaction/MCP guidance is also corrected. This
intake changes only generated provenance manifests, not browser contracts.
The preceding e23/32b pair passed exact source and connector CI; the new pair's
local gates and remote status remain distinct. No live UI or installed evidence
is claimed by source checks or generated metadata.
This exact cff intake passes backend comparison, complete connector checks,
1,092 tests (two intentional skips), six focused parity/documentation tests and
the development build including Community-review checks.

Windows constrained execution currently requires disjoint Project/member roots
and runtime prerequisites; whole-Vault or protected memory/storage overlaps are
unavailable, with no Full fallback. The exact e23 ordinary-Project batch passed
all 19 functional cases and the first 18 effect checks, but final Stop left
temporary grants/profile residue. Later cff8/c19 and ae04/c442 Stop attempts
failed before successful cancellation, with cleanup observed only after natural
exit. The fixed-eligibility mixed-revision regression now passes selected read,
ordinary Stop and effect checks using host5e03 plus the immutable cff8 worker SEA.
That functional proof is not final installed-pair acceptance; no old residue
repair is implied, and real constrained fish acceptance remains pending.
The older failed nested-root receipt remains historical. POSIX's exact `86bb`
mechanism packet passed 28 cases across four
targets; it is not installed support for this pair. A fresh standalone SEA is
used for Windows native validation first. Normal canonical reconciliation may
then build a separately identified installation artifact after native success
and exact disposable-vault preflight. Neither artifact is relabeled as the
other; installed Verify and UAT remain separate acceptance steps.
At that historical checkpoint mode/network policy remained installation-global;
app-authority grants were Vault/Project-specific. The current session-owned
mode/network change above supersedes only that former mode/network scope.

The earlier external-cache projection baseline was source
`c047e8ea3900d41e55436d688b8b0988a9fc04ab`. New developer bundles are staged
under the canonical external runtime cache; old current/rollback locations
remain explicit and untouched. This paired code-integrity change does not
establish installed sandbox support. macOS's approved lifecycle is confirmed
owned-job Stop/drain with best-effort detached cleanup; survivors keep original
launch restrictions. Those historical helper requirements do not establish
Landstrip's alpha lifecycle or native readiness.

The native setup/recovery UI is paired with source
`29e15d4442c66dfce92916ec4a1f0c1f5e21bbf9`. Its optional negotiated capability
does not relax earlier runtime parser/version checks. Unit/projection gates
prove consent routing only: current product composition still reports
unavailable without the verified Setup installation and shared native broker.
No native root setup, ACL effect, installed-vault reload or full-platform
acceptance follows from this connector checkpoint.

The earlier `c0d6692` checkpoint passed exact backend comparison, connector checks and
build, 127 focused UI/protocol/composer/projection tests, and the final complete
1,038-test suite (two intentional skips), including three added native
negotiation cases. These are synthetic DOM and transport results, not screenshots.
The earlier custom-helper source added exact durable tuple reuse across chats
and joined native verification cancellation. Its first-time mode/network
combinations required explicit setup. The approved basic alpha boundary is accidental-change mitigation,
ordinary Network On and supplied-tools/CLI vault access, not adversarial host-IPC
containment. The historical USER-message failure remains evidence against the
stronger claim; it is not relabeled as a passed basic capability.

The earlier Verify UI consumer targeted sealed source
`d4a65c118e2adb8c569b05a579e72ce00b8e35f0`. Its 130 focused DOM/controller/composer
tests passed while canonical generated projections and full exact-pair gates
awaited the coherent native-shell source checkpoint. Source Verify uses one protected
record and actual fixed observations, invalidates earlier proof on a fresh
capability contradiction, and keeps unknown owned cleanup unavailable. There
is no automatic verification, local proof invention or exact-CI-OS equality gate
for ordinary alpha users.

The historical ac5b SEA passed fixed file-worker startup under the custom Windows helper.
Configured Git Bash did not pass: the corrected layout and owned MSYS namespace
bootstrap reached a non-LOCAL signal-pipe denial, with clean owned Job/streams.
The owner subsequently approved a native Windows shell route. Those historical
custom-helper results do not certify the adopted Landstrip backend. Its accepted
PS7 startup proof remains separate from the pending basic-controls batch,
installed Verify and paired UAT; no native execution or installation follows
from this connector checkpoint.

Private development pairing requires a matched schema-3 source/connector
upgrade: the executable and complete canonical runtime asset inventory are
verified through fresh staging and content-addressed caching before launch.
Older receipt versions remain preservation/rollback evidence only. Production
signed-package schemas, publication authorization, and exact disposable-vault
acceptance requirements are unchanged. Synthetic parser/shell and adoption
tests do not prove this follow-up is installed or live accepted.

The development inventory also covers every file of the finite Windows helper
closure, including upstream legal notices. Partial groups and native-to-base
downgrades are rejected; there is no adjacent-file wildcard or repair-in-place
fallback. Production still requires the complete signed bundle and independent
native/setup acceptance, not merely a successful asset copy.

Development happens only in the private connector repository. Ordinary
feature branches merge into its default `dev` branch. A temporary
`release/<version>` branch is then cut from `dev`, paired with the matching
private runtime release branch, and used for candidate testing. After manual
acceptance, that exact connector commit promotes through a pull request into
private `main`. Public connector `main` receives only the separately authorized
projection of the approved private commit.

The public tag workflow publishes and verifies the exact three connector
assets before it advances public `main`. Promotion remains fast-forward only.
After the ref update, the workflow polls the remote ref for a bounded interval
before asserting equality, because the branch read can briefly lag the
successful update. A timeout fails the workflow; it does not force or repeat
the promotion.

GitHub-facing Markdown has a separate, non-release projection. Run
`npm run project:public-docs -- --destination <absolute-public-checkout>` for a
read-only JSON receipt, then repeat with `--apply` only after the private docs
change is accepted and public projection is authorized. The command verifies
both repository identities, requires clean source and destination checkouts
before applying, and can modify or retire only the Markdown paths explicitly
listed in `config/public-documentation-projection.json`. It does not stage Git
changes,
open a pull request, change a version, create a tag, or touch plugin/release
assets. Review the resulting public checkout diff before opening a docs-only
pull request.

This GitHub documentation path is distinct from the installed Chatobby Guide.
Connector 0.4.3 continues to use its signed exact-version guide asset. A newer
consumer reads the signed stable `guide-channel.json`, verifies its inclusive
connector and consumer-schema ranges, then fetches only the immutable
content-addressed guide revision it names. After that consumer is released,
compatible Guide content may advance through an explicitly authorized public
runtime-repository pull request without changing a product version, tag,
runtime bundle, release index, or existing release asset.

The private release workflow is intentionally inert: the tag-triggered
publisher runs only when `github.repository` is
`TitanicEclair/chatobby-obsidian`. A private tag can therefore never create a
connector release accidentally.

### Current private CI and live-acceptance readiness

Read-only GitHub inspection on 2026-09-05 established the following current
state. This is an operating snapshot, not proof that the target runner was
provisioned:

- Private connector [PR #42](https://github.com/TitanicEclair/chatobby/pull/42)
  [CI run 33944284595](https://github.com/TitanicEclair/chatobby/actions/runs/33944284595)
  at connector revision `4b5841b9bc270b9ab205776b71c0edebe421600d`
  passed classification, branch policy, repository verification, and exact
  connector-artifact build. Its `live-obsidian-smoke` job was skipped by design
  because the job accepts trusted branch pushes, not pull-request code. This is
  historical evidence for that exact head, not proof for later PR commits.
- The corresponding private `dev` push
  [live-smoke job](https://github.com/TitanicEclair/chatobby/actions/runs/33917812055/job/101169636058)
  is queued without a runner name or group. A queued job is not a pass.
- The private connector and source repositories each report zero registered
  self-hosted runners. The connector repository has an environment named
  `chatobby-disposable-obsidian`, but it currently has no protection rules or
  deployment-branch policy.
- `CHATOBBY_CI_VAULT_ROOT`, `CHATOBBY_CI_VAULT_NAME`,
  `CHATOBBY_CI_OBSIDIAN_CLI`, and `CHATOBBY_CI_RESET_SCRIPT` are unset at the
  connector repository and environment scopes. These are path and identity
  configuration names; no secret value belongs in this record.
- Installed-vault TEST-3 for the active connection-settings source/connector
  pair remains pending. Green private pull-request verification and artifact
  build therefore prove reviewable connector bytes, not installed paired
  behavior or live acceptance.

The subsequent Project browsing/rootless-label and font-stack checkpoint passed
46 focused tests, `npm run check`, the full connector suite (833 passed, two
skipped), and `npm run build` including Community-review checks in fresh isolated
test state. It is a feature-consolidation checkpoint, not live acceptance.
Regenerate all canonical projections against the settled merged source revision
before the exact backend-contract and paired live gates; the earlier projection
receipt does not establish compatibility with that future source tree.

The final local union regenerated all five canonical projections from clean
source revision `df9aec0c0c9c351c4b66713a92ed102926fa814f`. Its only delta from
the full-suite-tested source union is DEV-1 runner-readiness documentation;
generated contract bytes are unchanged and the three projection manifests now
identify that exact final revision. This is provenance and compatibility
evidence, not an installed-vault or public-release acceptance claim.

The intended runner path becomes usable only after an owner:

1. registers a dedicated Windows x64 self-hosted runner with the exact
   `chatobby-disposable-obsidian` label and keeps it unavailable to pull
   requests, forks, and arbitrary feature branches;
2. configures the four variables above to one runner-owned disposable vault,
   its registered vault name, the exact Obsidian CLI, and a reviewed absolute
   reset-script path;
3. manually installs Obsidian 1.12.7 or later, enables and registers its command
   line interface, permits community plugins in the golden disposable profile,
   and enables Chatobby there; and
4. adds the intended environment branch and reviewer protections, or removes
   the inaccurate claim that the environment is protected.

The reset script must fail closed outside the runner-owned profile and vault,
restore that bounded state before and after the job, and remain outside
untrusted repository input. As a local alternative, the same Windows account
can own one controlled synthetic-profile test only after the owner closes every
existing Obsidian process and keeps the primary profile closed for the complete
test; otherwise the username-scoped Obsidian CLI pipe is ambiguous. This is a
manual prerequisite, not automation authorization.

Every public version must:

1. use the same plugin and runtime version and tag;
2. pass repository checks and focused lifecycle tests;
3. produce the runtime package before the connector so the connector embeds the
   matching public key;
4. pass runtime package verification and `doctor` from the packaged directory;
5. pass the connector release-artifact scan;
6. be installed into a disposable vault before publication;
7. include the exact signed guide asset and publish the runtime release before
   the plugin release;
8. install the exact uploaded connector/runtime pair in the isolated Obsidian
   acceptance runner; and
9. verify the uploaded assets and Community-plugin listing after publication.

Published tags and release assets are immutable. A defect discovered after
publication is corrected with a new patch version, never by replacing files on
an existing tag.

## GitHub Actions storage

The source repository's `config/chatobby.operations.json` remains the product
authority for Actions retention. This repository carries the validated
connector projection in `config/actions-storage-policy.json`: candidate
transfer shards are retained for one day, aggregate/resume candidates for
seven days, portable evidence for 14 days, monitoring/staging evidence for 30
days, and caches become cleanup candidates after 30 days without access.
Unknown artifact names are unmanaged and remain retained for classification.

`npm run check:actions-storage` validates the schema and requires every future
`actions/upload-artifact` step to state one governed `retention-days` value.
The current CI and release workflows upload no Actions artifacts. Their
`setup-node` npm caches remain lockfile-keyed; the cleanup policy is a maximum
age, while GitHub may evict an unused cache sooner.

`.github/workflows/actions-storage.yml` runs a weekly read-only inventory and
uploads no receipt artifact. A manual execute run requires the protected
`chatobby-actions-storage-cleanup` environment, exact artifact/cache IDs, and
any active candidate or forensic workflow-run IDs that must remain protected.
The script re-inventories before selection, refuses unclassified, young, or
protected artifacts, and caps one cleanup at 50 objects or 10 GiB. It exposes
only artifact and cache deletion endpoints; workflow runs, releases, tags, and
release assets are outside its API boundary.

This schema adds no plugin or vault state and requires no user migration. The
job-scoped `GITHUB_TOKEN` is read only from the environment and is excluded
from receipts. Reverting the workflow, script, and policy disables future
cleanup without affecting connector runtime behavior; an object already
deleted by an explicitly approved run cannot be restored.

## Remaining stable-release gates

These do not block the explicitly labelled public alpha, but they remain gates
for a stronger stable or paid release claim:

- Authenticode-sign and timestamp the runtime executable if Windows publisher
  identity is required;
- exercise update, rollback, and uninstall on a clean Windows account;
- maintain offline recovery instructions for a failed runtime update;
- complete qualified legal review of stable/commercial terms; and
- document signing-key rotation and incident response.
