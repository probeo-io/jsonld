# Vocabulary-driven JSON-LD validator acceptance specification

## Contract gate

Before replacing validation internals, run `npm test` and `npm run build` in this package, then `npm test` in `engine/signals`. The signals contract test intentionally imports this workspace package's compiled output. Build this package first. The public artifact contract remains `ValidationResult` / `BlockResult` / `ValidationIssue` in `src/types.ts`.

`tests/result-contract.test.ts` validates JSON-serialized results: exact allowed fields, primitive types, optional-field omission, aggregate count consistency, block order/indexes, declared type preservation, and the relationship between errors and validity. Fixtures include no markup, malformed JSON, valid types, missing fields, graphs, nesting, and multi-type nodes. The empty-document result is the structural golden fixture; rule-specific counts and messages are not global golden snapshots.

`engine/signals/test/jsonld-contract.test.mjs` feeds actual serialized output into the production finding extractor and fact builder. It verifies locators, severity mapping, finding labels, duplicate-path occurrence-key uniqueness, empty output, and warehouse record validation. The focused test uses the TypeScript AST to compile the actual pure extractor functions from `src/run.ts`, importing the real warehouse occurrence-key builder and validators; it does not copy their implementation or stub validation. Run it with `npm run test:jsonld-contract` in signals after building this package. Tests must keep passing after the rewrite. Tests are not permission to change the artifact schema.

## Behavioral acceptance cases for the subsequent implementation

These are requirements, not claims of current coverage. Add executable fixtures with the implementation; do not add skipped tests that imply these capabilities already exist.

- ExerciseGym inherits properties through SportsActivityLocation and LocalBusiness and through both Organization and Place. Diamond inheritance deduplicates inherited constraints. Do not inherit arbitrary Google-required fields into Schema.org validity.
- Inherited property names and value ranges come from the pinned vocabulary. Accept documented alternatives: address can be Text or PostalAddress; multiple permitted ranges are alternatives, not simultaneous requirements. Unknown properties and incompatible values produce explicit vocabulary findings. Preserve Schema.org's documented permissive treatment of textual values; the severity/coercion policy must be finalized before implementing range checks.
- Multi-type declarations are evaluated as a set. Shared graph nodes and repeated @id references resolve within the document, including across JSON-LD blocks on the same page. @id-only references do not generate false missing-@type findings. Cycles terminate without duplicate findings or recursive overflow; external references are not fetched.
- Cover inline contexts, aliases, @vocab, @base, scoped contexts, canonical Schema.org IRIs, @value, @list and @set. Unsupported external contexts yield an explicit unsupported-coverage finding rather than fabricated unknown-type findings. No runtime vocabulary/context network fetches.
- Google eligibility is distinguished in issue messages from Schema.org findings while preserving the issue fields and severities. Audit existing profiles against cited, dated primary documentation. Article must not retain false required-field errors: current Google guidance says it has no required properties. Missing Google-required fields affect eligibility, not the claim that a Schema.org term is invalid.
- Repeated validation of identical input and the same pinned data/rules produces byte-identical serialized output. Traversal and finding order must be deterministic.
- Define concrete input-size, depth, node-count and processing-budget limits before implementation. Boundary fixtures must prove oversized/deep inputs return a normal diagnostic result without crashing the pass or fetching remote resources. Limit diagnostics use the existing external result shape.

## Remaining design decisions before a full rewrite

Select the JSON-LD processor and decide the calling convention for any asynchronous normalization; serialized output compatibility is mandatory. Define exact vocabulary warning/coercion policy and resource limits. Specify unsupported-context diagnostics and source-path mapping through normalization. Enumerate audited Google profiles and their applicability rather than blindly copying parent rich-result rules. These decisions belong in the implementation specification before engine changes.

## Rollout boundary

This testing-first change adds tests and this acceptance specification only. No new validation behavior, skipped behavioral promises, dependency upgrades, pass-image rebuilds, workflow changes, or production deployment are included. The existing vocabulary-recognition change remains independently committed and undeployed to engine containers.

References: https://schema.org/docs/datamodel.html ; https://schema.org/docs/developers.html ; https://developers.google.com/search/docs/appearance/structured-data/article ; https://developers.google.com/search/docs/appearance/structured-data/sd-policies

## Verification of this testing-first change

Package tests: 97 passed; TypeScript build passed. The focused signals consumer test passed. The complete signals build/suite is blocked in the current checkout by absent `@probeo/engine/core` and telemetry build outputs and mismatched installed security/warehouse types. No dependencies were upgraded to conceal that pre-existing environment problem. Build artifacts produced by the failed signals compilation were restored; no signals runtime changes are included. The complete suite must still run in a coherent dependency checkout before a later validator/image rollout.
