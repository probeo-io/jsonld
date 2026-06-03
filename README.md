# @probeo/jsonld

Fast, zero-dependency JSON-LD validator. Validates schema.org structured data against Google rich results requirements.

There's no good package for this. Existing options are either too loose (just check JSON is valid) or too complex (full JSON-LD spec compliance nobody needs). This is the practical middle ground — validate what Google actually cares about, fast, zero deps, clear output.

## Install

```bash
npm install @probeo/jsonld
```

## Usage

### Validate from HTML

```typescript
import { validateHtml } from "@probeo/jsonld";

const result = validateHtml(html);

console.log(result.blocks);    // number of JSON-LD blocks found
console.log(result.errors);    // total error count
console.log(result.warnings);  // total warning count
console.log(result.results);   // per-block results
```

### Validate a parsed object

```typescript
import { validateObject } from "@probeo/jsonld";

const result = validateObject({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "My Article",
  author: { "@type": "Person", name: "Jane Doe" },
  datePublished: "2024-01-15",
});

console.log(result.valid);   // true/false
console.log(result.issues);  // array of ValidationIssue
```

### Get all issues sorted by severity

```typescript
import { validateHtml, getIssues } from "@probeo/jsonld";

const result = validateHtml(html);
const issues = getIssues(result); // errors first, then warnings

for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.path}: ${issue.message}`);
}
```

## Output

```typescript
interface ValidationResult {
  blocks: number;    // JSON-LD blocks found
  errors: number;    // total errors across all blocks
  warnings: number;  // total warnings across all blocks
  results: BlockResult[];
}

interface BlockResult {
  index: number;              // nth block on the page
  type?: string | string[];   // @type value(s)
  valid: boolean;             // false if any errors
  issues: ValidationIssue[];
}

interface ValidationIssue {
  path: string;              // e.g. "$.headline", "$.offers[0].price"
  message: string;
  severity: "error" | "warning";
  type?: string;
}
```

Errors are things Google won't use (missing required fields, invalid JSON, missing @context).
Warnings are things that reduce quality or rich result eligibility (missing recommended fields, bad URLs, missing image).

## Supported Types (25)

| Type | Rich Result |
|---|---|
| Article, BlogPosting, NewsArticle | Articles |
| Product, Offer | Products |
| Organization, LocalBusiness | Knowledge panel |
| Person | People |
| WebSite, WebPage, AboutPage, ContactPage | Sitelinks, pages |
| FAQPage, Question | FAQ |
| BreadcrumbList, ListItem | Breadcrumbs |
| HowTo, HowToStep | How-to |
| Event | Events |
| Review, AggregateRating | Reviews |
| VideoObject, ImageObject | Video, Images |
| JobPosting | Jobs |
| Recipe | Recipes |
| SoftwareApplication | App |
| Course | Courses |
| Service | Services |

## What It Checks

- **@context** — present and references schema.org
- **@type** — present, recognized, not a plugin/theme fake type
- **Required fields** — per Google's rich results requirements
- **Recommended fields** — flagged as warnings, not errors
- **Field types** — URLs look like URLs, dates are ISO 8601, prices are positive numbers
- **Nested types** — e.g. `Product.offers` should be `Offer`, `BreadcrumbList.itemListElement` should be `ListItem`
- **@graph** — validates all nodes inside `@graph` blocks

## See Also

| Package | Description |
|---|---|
| [fast-a11y](https://github.com/probeo-io/fast-a11y) | Zero-DOM accessibility checker |
| [@probeo/anymodel](https://github.com/probeo-io/anymodel) | Unified LLM router |

## License

MIT
