# @probeo/jsonld

[![npm version](https://img.shields.io/npm/v/@probeo/jsonld)](https://www.npmjs.com/package/@probeo/jsonld)
[![npm downloads](https://img.shields.io/npm/dm/@probeo/jsonld)](https://www.npmjs.com/package/@probeo/jsonld)
[![license](https://img.shields.io/npm/l/@probeo/jsonld)](https://github.com/probeo-io/jsonld/blob/main/LICENSE)
[![CI](https://github.com/probeo-io/jsonld/actions/workflows/ci.yml/badge.svg)](https://github.com/probeo-io/jsonld/actions/workflows/ci.yml)

Fast, zero-dependency JSON-LD validator for schema.org structured data.

## Why?

There's no good package for this. Existing options are either too loose (just check JSON is valid) or too complex (full JSON-LD spec compliance that nobody needs for SEO). This is the practical middle ground — validate what Google actually requires for rich results, fast, zero dependencies, clear output.

Tested against real production sites. The bugs it catches are real.

## Install

```bash
npm install @probeo/jsonld
```

## Usage

### Validate from HTML

Pass raw HTML and get results for all JSON-LD blocks on the page:

```typescript
import { validateHtml } from "@probeo/jsonld";

const result = validateHtml(html);

console.log(result.blocks);    // 2
console.log(result.errors);    // 3
console.log(result.warnings);  // 5
console.log(result.results);   // per-block results
```

### Validate a parsed object

```typescript
import { validateObject } from "@probeo/jsonld";

const result = validateObject({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "My Article",
  "author": { "@type": "Person", "name": "Jane Doe" },
  "datePublished": "2024-01-15",
});

console.log(result.valid);   // true
console.log(result.issues);  // warnings for missing recommended fields
```

### Get all issues sorted by severity

```typescript
import { validateHtml, getIssues } from "@probeo/jsonld";

const result = validateHtml(html);

for (const issue of getIssues(result)) {
  console.log(`[${issue.severity}] ${issue.path}: ${issue.message}`);
}
// [error]   $.headline: Missing required property "headline" for Article
// [warning] $.image: Missing recommended property "image" for Article
```

## Output

```typescript
interface ValidationResult {
  blocks: number;    // JSON-LD blocks found on the page
  errors: number;    // total errors (block is invalid, Google won't use it)
  warnings: number;  // total warnings (reduces quality, may miss rich results)
  results: BlockResult[];
}

interface BlockResult {
  index: number;              // nth block on the page (0-indexed)
  type?: string | string[];   // @type value(s)
  valid: boolean;             // false if any errors present
  issues: ValidationIssue[];
}

interface ValidationIssue {
  path: string;              // dot notation — "$.headline", "$.offers[0].price"
  message: string;
  severity: "error" | "warning";
  type?: string;             // the schema type that raised this issue
}
```

**Errors** mean Google will not use the structured data (missing required fields, invalid JSON, missing `@context`).

**Warnings** mean the data is valid but incomplete — missing recommended fields, non-URL values in URL fields, non-ISO dates.

## What It Validates

### Structure
- `@context` present and references schema.org (`http://` and `https://` both accepted)
- `@type` present and is a recognized schema.org type
- `@graph` blocks — each node validated individually
- Suspicious plugin/theme types flagged (`SEO`, `Tapita`, `Booster`, etc.)

### Required and recommended fields
Per-type required and recommended properties matching Google's rich results documentation. Missing required fields are errors. Missing recommended fields are warnings.

### Field types
- URL fields (`url`, `image`, `logo`, etc.) — must look like a URL
- Date fields (`datePublished`, `uploadDate`, etc.) — must be ISO 8601
- Number fields (`price`, `ratingValue`, etc.) — must be positive numbers
- Protocol-relative URLs (`//cdn.example.com`) accepted as valid

### Nested types
- `Product.offers` → `Offer` or `AggregateOffer`
- `BreadcrumbList.itemListElement` → `ListItem`
- `FAQPage.mainEntity` → `Question`
- `Question.acceptedAnswer` → `Answer`
- `HowTo.step` → `HowToStep` or `HowToSection`
- `Event.location` → `Place` or `VirtualLocation`
- `Review.reviewRating` → `Rating`
- And more — see schema type definitions

## Supported Types (25)

Covers every schema.org type Google uses for rich results:

| Type | Rich Result Feature |
|---|---|
| `Article`, `BlogPosting`, `NewsArticle` | Article rich results |
| `Product`, `Offer`, `AggregateOffer` | Product rich results |
| `Organization`, `LocalBusiness` | Knowledge panel, local pack |
| `Person` | Knowledge panel |
| `WebSite`, `WebPage`, `AboutPage`, `ContactPage` | Sitelinks search, breadcrumbs |
| `FAQPage`, `Question` | FAQ rich results |
| `BreadcrumbList`, `ListItem` | Breadcrumb trail |
| `HowTo`, `HowToStep` | How-to rich results |
| `Event` | Event rich results |
| `Review`, `AggregateRating` | Review snippets |
| `VideoObject`, `ImageObject` | Video, image rich results |
| `JobPosting` | Job posting rich results |
| `Recipe` | Recipe rich results |
| `SoftwareApplication` | App rich results |
| `Course` | Course rich results |
| `Service` | Service rich results |

Unknown types produce a warning but not an error — the block is still considered valid.

## Real-World Behavior

Validated against real production sites. A few things this catches that simpler validators miss:

- **Epoch date defaults** — CMS systems often default `datePublished` to `0001-01-01T00:00:00`. Flagged as a bad date format.
- **ratingCount vs reviewCount** — Google accepts both. Many sites use `ratingCount`. Both pass.
- **Relative vs absolute URLs** — `/images/photo.jpg` fails the URL check. `//cdn.example.com/photo.jpg` passes (protocol-relative is valid).
- **Nested type mismatches** — `Product.offers` containing a `Service` instead of an `Offer` is flagged.
- **Missing priceCurrency** — Required on `Offer` even when price is `0`.
- **Plugin schema spam** — Types like `TapitaSEOApp`, `SeoBooster` flagged as suspicious.

## Replacing manual schema validation

If you're currently validating JSON-LD by hand or with a one-off regex:

```typescript
// Before
const scripts = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
const json = JSON.parse(scripts[0].replace(/<[^>]+>/g, ''));
if (!json['@type'] || !json.name) throw new Error('invalid schema');

// After
import { validateHtml } from "@probeo/jsonld";
const result = validateHtml(html);
if (result.errors > 0) {
  console.log(getIssues(result).filter(i => i.severity === 'error'));
}
```

## See Also

| Package | Description |
|---|---|
| [fast-a11y](https://github.com/probeo-io/fast-a11y) | Zero-DOM accessibility checker with axe-core compatible output |
| [@probeo/anymodel](https://github.com/probeo-io/anymodel) | Unified LLM router, 11+ providers |

## License

MIT
