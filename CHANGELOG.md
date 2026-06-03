# Changelog

## [0.1.0] - 2026-06-03

### Added

- Initial release
- Zero-dependency JSON-LD validator for schema.org structured data
- 25 schema types covering all Google rich results use cases
- Required and recommended field validation per type
- Field type validation — URLs, ISO dates, positive numbers
- Nested type validation (Product→Offer, FAQPage→Question, etc.)
- `@graph` block support
- Suspicious plugin/theme type detection
- `validateHtml(html)` — extract and validate all blocks from raw HTML
- `validateObject(obj)` — validate a parsed JSON-LD object
- `getIssues(result)` — all issues sorted errors-first
- 50 tests including real-world examples from production crawls
