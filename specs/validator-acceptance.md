# Vocabulary-driven JSON-LD validation

## Implementation and external contract

The validator remains synchronous and zero-dependency. HTML extraction uses regex, followed by `JSON.parse` and traversal of plain objects. There is no DOM, document loader, filesystem access, socket, worker, timer, or runtime vocabulary download. Only the explicit vocabulary-generation script performs file/network IO.

`ValidationResult`, `BlockResult`, and `ValidationIssue` retain their fields and serialized shape. Findings keep original property aliases in source paths. Existing `$[n]` graph locators remain; nested arrays retain their actual array indexes, including single-element arrays. Declared block types remain as supplied. Malformed type values are diagnosed and omitted from the optional result `type` field rather than violating its string/string-array contract.

The 11 compiled-output contract fixtures and the signals consumer test exercise actual serialized results, locators, severity mapping, occurrence keys and warehouse validation.

## Vocabulary and range policy

Schema.org 30.1 is bundled: 938 classes, 1,538 properties, 546 declared vocabulary values. Generator outputs record the official source URL and SHA-256. Class membership, multiple inheritance, property domains, alternative ranges, subproperties and superseded-property names are independent of detailed search profiles.

A property's own domain/range takes precedence over its parent property's broader declaration. Parent declarations supply missing metadata. Multiple types, domains and ranges are alternatives. Diamond inheritance is deduplicated. All explicitly declared detailed types run, rather than selecting the first profile; vocabulary ancestors never automatically introduce Google-required fields.

Unknown properties, incompatible domains, incompatible primitive/object values, wrong known enumeration IRIs and superseded properties produce warnings. Text remains permissive as documented by Schema.org; arbitrary textual values are not coerced or rejected. Nulls are ignored. Untyped objects and unresolved references cannot establish a range mismatch, so are not rejected. Known typed object values and references are checked against all alternative ranges, including subclasses. Existing field-format validators remain active for their detailed profiles.

## Contexts and references

Supported in-memory context operations: canonical HTTP/HTTPS Schema.org contexts/IRIs, conventional `schema:` prefix, inline term and keyword aliases, prefixes, forward term definitions, `@vocab`, `@base`, null resets, property-scoped and type-scoped contexts. Scoped contexts are lexical; they do not leak into siblings. `@value`, `@list` and `@set` wrappers are inspected without treating them as entities missing a type.

`@id` definitions are indexed across the page's blocks, with combined declared types and available properties. References are inspected through that index; they are never recursively expanded or fetched. Duplicate definitions use the last non-null/nonempty field for presence checks; each physical declaration's values are still validated at their own paths. Cyclic references and cyclic JavaScript objects terminate.

This is a practical Schema.org validator, not a complete JSON-LD 1.1 processor. External contexts other than canonical Schema.org, language/index/id map containers, `@import`, `@propagate`, `@reverse`, `@nest`, and unsupported term definitions produce explicit partial-coverage warnings. Vocabulary/profile inference is suppressed in an affected scope to avoid fabricated findings based on unknown aliases. Language/direction/protected declarations are tolerated; full JSON-LD processing semantics such as protected-term enforcement are not claimed. Cyclic or excessive alias definitions produce coverage warnings. No remote context can cause a request.

## Detailed profiles and Google guidance

Reviewed 2026-11-05:

- Article, BlogPosting and NewsArticle: Google lists no required properties. Missing headline, author, publication/modification dates and image are recommendations only. Messages say `Google recommendation (Article)`. https://developers.google.com/search/docs/appearance/structured-data/article
- LocalBusiness and Store: existing name/address presence checks are labeled `Google eligibility (LocalBusiness)`. They apply to those explicitly declared types, not every subclass. These checks are not a complete eligibility certification. https://developers.google.com/search/docs/appearance/structured-data/local-business
- BreadcrumbList: existing item/name/position rules remain, including nested names and optional final item. Contextual failures say `Google eligibility (Breadcrumb)`. https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

Other existing profiles retain their behavior and are explicitly labeled `Structured-data profile`, not represented as newly audited Google rules. Their comprehensive Google applicability/requirements audit remains separate. In particular, FAQ/HowTo legacy checks do not assert current Google feature availability. No profile certifies visibility, page-content agreement or Google eligibility by itself.

## Deterministic resource limits

Limits use counts, not wall-clock timers, so repeated inputs produce identical output:

| Budget | Limit |
| --- | ---: |
| HTML length | 16,000,000 UTF-16 code units |
| One JSON script | 2,000,000 code units |
| Combined JSON scripts / object string budget | 4,000,000 code units |
| Scripts | 256, followed by one diagnostic result if exceeded |
| Object/array depth | 64 |
| Unique objects/arrays per page | 10,000 |
| Own entries across the page | 100,000 |
| One object-API string | 2,000,000 code units |
| Terms per context | 256 |
| Alias resolution depth | 64 |
| Findings per block | 1,000, including the terminal diagnostic |

Object preflight runs iteratively before recursive node traversal. Size/depth/node/entry/finding failures return ordinary error findings; context coverage limits return coverage warnings. Oversized HTML returns one diagnostic block without extraction. Object-budget failures affect all parsed blocks on the page, preventing partial indexing from silently changing reference results. Malformed-JSON blocks retain their parse errors.

## Verification and rollout boundary

Run `npm test` (builds first), `npm run test:contract`, and `npm run validate:fixture -- tests/fixtures/exercise-gym.html` in this package. Then run `npm run test:jsonld-contract` in `engine/signals` against the compiled candidate package. New fixtures cover inherited domains/ranges, aliases/scopes, graph and cross-block references, malformed shapes, cycles, limits, deterministic output, synchronous calls, and the absence of external runtime imports/DOM/IO entry points.

The complete signals suite was previously blocked by missing engine/telemetry outputs and mismatched installed security/warehouse types. The focused consumer test is independent of those unrelated runner dependencies. No signals runtime changes, dependency updates, container rebuilds, staging deployment, or production deployment are part of this package change.

Vocabulary references: https://schema.org/docs/datamodel.html ; https://schema.org/docs/developers.html ; https://schema.org/version/30.1/schemaorg-current-https.jsonld

Latest local verification: 151 package tests passed across six files, including the compiled result-contract tests; TypeScript build passed; the signals-to-warehouse contract test passed; the standalone ExerciseGym HTML fixture returned zero errors and warnings. The runtime-boundary test walks compiled JavaScript ASTs to reject external imports and DOM/IO entry points. Dependency manifests remain unchanged. A synthetic 30-run local benchmark measured median 0.04 ms / 1.53 ms / 13.34 ms for 1 / 100 / 1,000 gym entities with address and geo children; these are local timing observations, not staging throughput guarantees.

## Reproducible fuzz testing

`tests/fuzz/worker.mjs` generates independent cases from 32-bit seeds. `scripts/fuzz.mjs` runs them in subprocesses with a 192 MiB V8 heap cap and a hard 20-second timeout per 2,000-case shard. The last started seed is captured before validation, allowing replay after crashes, synchronous hangs or memory failures. `npm test` includes a 2,000-case corpus; `npm run test:fuzz -- --cases 20000` runs the extended corpus. Use `--seed N --cases 1` to reproduce one case.

Oracles check absence of throws/process failures, synchronous serializable output, exact result/issue fields, block indexes, aggregate counts, severity/validity consistency, the finding cap, deterministic repeat calls, frozen-input mutation failures and unchanged Object.prototype descriptors. Generated families cover arbitrary object trees, mutated typed entities, cross-block reference graphs, corrupted JSON/HTML, cyclic JavaScript graphs/containers, hostile property names and coercion shapes, and depth/finding-limit boundaries. These are robustness invariants, not an independent JSON-LD semantic oracle.

The expanded corpus found seed 117: coercing an invalid context `@container` object to string could throw. Context processing now checks the container's type directly; `tests/fuzz-regressions.test.ts` retains minimized object and HTML cases, including null-prototype and non-coercible JSON objects.
