# Projects connector owners

Start from [frontend architecture](../../../docs/architecture/frontend-modules.md#projects-contract-boundary)
and [responsibility boundaries](../../../docs/responsibility-boundaries.md).
Other features import [public.ts](public.ts); generated models and parsers come
through the public `frontend-contracts.ts` facade. Change wire schemas in the
source repository, then regenerate the connector projection.

| Owner | Responsibility |
| --- | --- |
| [Directory launch](application/directory-project-launch.ts) | File-explorer start/create/browse decisions. The plugin supplies current runtime, utility transport, settings, modal and leaf operations. |
| [Project actions](application/project-actions.ts) | Canonical action types plus device-local picker inputs; exact-operation/intent registration replaces absolute paths with opaque candidates before dispatch. |
| [Screen controller](application/projects-screen-controller.ts) | Screen refresh/selection, current protocol dispatch, marker retry, creation draft and page lifetime. |
| [Creation draft](application/project-creation-draft.ts) | Unsaved name/folders/primary selection and local paths needed for an explicit retry. No durable Project state. |
| [Directory observations](application/project-directory-observation-service.ts) | Bounded native folder-event queue and bridge delivery. No marker interpretation. |
| [UI guide](ui/README.md) | Native navigator, Project presentation, modal focus and dismissal. |
| [Directory picker](infrastructure/system-directory-picker.ts) | Device-local native selection; a picked path is not authorization or durable identity. |

Browsing never rebinds the running chat. Project revisions, candidate expiry,
marker interpretation, permissions and storage remain runtime-owned. The
controller keeps draft/retry identity; protocol/store owners reject stale
responses. Launch cancellation precedes new-leaf creation. UI destruction
disposes its listeners without ending session-owned runtime work.

Tests and their limits are linked in the [parent architecture guide](../../../docs/architecture/frontend-modules.md#projects-contract-boundary).
Current data fixtures live in [test support](../../../tests/support/projects/README.md).
This folder has no connector-owned Project data model or migration.
