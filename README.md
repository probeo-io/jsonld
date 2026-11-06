# @probeo/jsonld

Synchronous, zero-dependency Schema.org validation from HTML or parsed objects. Extraction uses regex; validation uses plain JavaScript objects and bundled vocabulary data. No DOM, network requests, filesystem access, or background work occurs during validation.

```ts
import { validateHtml, validateObject, getIssues } from '@probeo/jsonld';

const result = validateHtml(html);
// { blocks, errors, warnings, results }

const block = validateObject({
  '@context': 'https://schema.org',
  '@type': 'ExerciseGym',
  name: 'Bridge Performance',
  address: { '@type': 'PostalAddress', streetAddress: '1 Main St' },
});
// { index: 0, type: 'ExerciseGym', valid: true, issues: [] }

for (const issue of getIssues(result)) {
  console.log(issue.severity, issue.path, issue.message);
}
```

## Output

```ts
interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
  type?: string;
}
interface BlockResult {
  index: number;
  type?: string | string[];
  valid: boolean;
  issues: ValidationIssue[];
}
interface ValidationResult {
  blocks: number;
  errors: number;
  warnings: number;
  results: BlockResult[];
}
```

`valid` means no error findings from the implemented checks. It does not certify Google eligibility or full JSON-LD 1.1 conformance. Vocabulary mismatches are warnings; structural failures, resource-limit failures and missing required detailed-profile fields are errors. Original property aliases remain in finding paths.

## Coverage

The pinned **Schema.org 30.1** model includes 938 classes, 1,538 properties and 546 declared vocabulary values. Types are recognized independently of detailed profiles. Property checks follow multiple inheritance, alternative domains/ranges, subproperties and superseded terms. Text is permissive in accordance with Schema.org's data model. Unknown/untyped values are not treated as proof of an incompatible object type.

All explicitly declared detailed profiles are evaluated; an ancestor's required fields are never automatically imposed on a subtype. Article/BlogPosting/NewsArticle no longer have false required-field errors. Google-reviewed findings are identified in their messages; other existing checks say `Structured-data profile`. See the [implementation specification](specs/validator-acceptance.md) for the profile audit boundary.

Supported context handling includes inline aliases, prefixes, keyword aliases, `@vocab`, `@base`, property/type-scoped contexts, canonical Schema.org IRIs and null resets. Graph nodes and references resolve across JSON-LD blocks on the same page. Nested entities, `@value`, `@list` and `@set` are inspected. Cycles terminate without recursively fetching or expanding references.

External contexts are never downloaded. Unsupported contexts/features produce explicit partial-coverage warnings and suppress affected vocabulary/profile inference. This intentionally does not implement every JSON-LD 1.1 operation. Exact unsupported features and deterministic size/depth/node/work limits are documented in the specification.

## Test directly

```sh
npm test
npm run test:contract
npm run validate:fixture -- tests/fixtures/exercise-gym.html
```

The fixture command builds the package, reads the supplied HTML file and prints the actual result object. The CLI's file IO is separate from the validator. The package test command builds before testing compiled public exports and regression fixtures.

## Refresh the bundled model

```sh
npm run vocabulary:update
# Or regenerate offline from the pinned vocabulary:
npm run vocabulary:update -- /path/to/schemaorg-30.1.jsonld
```

The generator records the official source URL and SHA-256 in both generated data modules. Review generated changes and run the tests before updating consumers. Runtime validation never fetches vocabulary data. See [Schema.org developer documentation](https://schema.org/docs/developers.html) and [data model](https://schema.org/docs/datamodel.html).

## Fuzz testing

`npm test` includes 2,000 deterministic generated cases against the compiled public APIs. Run a larger corpus or replay a failing seed with:

```sh
npm run test:fuzz -- --cases 20000
npm run test:fuzz -- --seed 117 --cases 1
```

Cases cover malformed JSON/HTML, arbitrary object shapes, contexts and aliases, invalid types and values, shared references, cyclic objects/containers, prototype-like keys, depth boundaries and finding-cap boundaries. Every case runs twice to check deterministic, serializable results and consistent counts/severities. Object inputs are frozen to expose mutations; prototype descriptors are checked for changes.

Workers run with a 192 MiB V8 heap cap and a 20-second subprocess timeout per 2,000 cases. A seed is recorded before execution so even a synchronous hang or process failure can be reproduced. These controls belong to the test harness, not runtime validation. Passing fuzz tests increases robustness confidence; it does not establish semantic correctness for every possible JSON-LD document. Discovered failures are preserved as minimized regression tests.
