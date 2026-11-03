# Projects fixtures

[screen.ts](screen.ts) provides current canonical screen/bootstrap values for
the parser/store and directory/action boundary tests. Viewed and running
Projects intentionally differ so browsing cannot silently become a scope change.

The fixtures contain no transport implementation, persistence or permission
authority. Test purpose and installed limits are in the
[Projects contract boundary](../../../docs/architecture/frontend-modules.md#projects-contract-boundary).
