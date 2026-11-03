# Composer owners

Start with the [Composer API and test-purpose guide](../../../docs/api/composer.md).
`composer.ts` retains keyboard/interaction/slash routing and ordered DOM restore.
One instance owns its `draft-state`, `submission-lifecycle` and
`attachment-presentation`; rebinding elements does not reset pending work or draft
references. The existing `references/` controller has its own stricter bind
lifetime. These owners hold transient input/presentation state; submitted history
and execution remain runtime-owned.

The [deferred submission fixture](../../../tests/ui/composer/submission-lifecycle.test.ts)
uses the real Composer and shell with controlled promises and synthetic file refs.
The API guide links ordinary input, reference, keyboard, control and transport
coverage, and distinguishes preserved teardown limits from guarantees. Run the
affected Composer suites plus connector check/full tests/build for owner changes;
installed acceptance is a separate exact-pair check.
