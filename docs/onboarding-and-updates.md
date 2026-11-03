# Welcome and update highlights

New users see a native Obsidian welcome modal after the workspace is ready.
It links to Chatobby Settings for local models, API keys, subscription sign-in,
and the Chatobby Guide. It does not create a chat or require a runtime connection.
Closing it allows exploration without configuration.
The welcome describes access from the canonical generated product execution
mode. Permission builds explain the three workspace modes and where to manage
approval requests and Chatobby and Obsidian tool access, independently of the
version used for published release notes.

Existing users see release highlights after an upgrade. The roadmap is labelled
Planned and is separate from shipped changes. Settings → What’s new reopens the
current highlights. There is no remote content fetch for either modal.
Development builds still welcome fresh users, but do not automatically open
published release highlights or mark them as viewed. Manually opened notes are
labelled published history and explain that the development build may differ.
Versioned release highlights remain unchanged historical records.

## State ownership and migration

`ProductIntroduction` owns presentation and disposal. `PluginSettings` and
`SettingsStore` own the vault-local `lastSeenPluginVersion` string in the
plugin's `data.json`. Its additive schema accepts a three-part version and an
optional prerelease suffix; missing or invalid values become an empty string.
This field contains no account, credential, runtime, or session information.

The existing numeric `onboardingVersion` distinguishes a fresh install from an
existing user whose settings predate the new field. Fresh users see Welcome;
existing release users see update highlights once. Dismissal persists the current
version and marks onboarding complete. Reloading or downgrading does not repeat
the modal or lower the stored version. Plugin unload closes an open modal
without acknowledging it. A failed save reports a notice and may show it again.
Older connectors ignore the new field; rolling back does not alter domain data.

Release copy lives in `src/ui/modals/product-intro-modal.ts`. Each release adds
its own versioned highlights; skipped releases are included. Unknown releases
offer a link to their release notes instead of inventing changes.

## Subscription browser handoff

The sign-in modal uses Obsidian's `_external` window target for the system
default browser. The runtime still owns login, cancellation and credentials.
The shared runtime OAuth completion page uses a plain title and status message;
it does not display the inherited Pi artwork.

## Verification

Focused tests cover fresh and migrated settings, upgrades, reloads, downgrades,
prereleases, dismissal, plugin unload, Settings navigation, roadmap separation,
canonical execution-mode copy, development history suppression, and the
external-browser target. Live acceptance checks the disposable vault,
light/dark themes, narrow layout, and persisted dismissal.
