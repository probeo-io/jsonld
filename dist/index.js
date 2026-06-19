/**
 * @probeo/jsonld — Fast, zero-dependency JSON-LD validator.
 *
 * Validates schema.org structured data against Google rich results requirements.
 *
 * Usage:
 *   import { validateHtml, validateObject } from "@probeo/jsonld";
 *
 *   const result = validateHtml(html);
 *   const result = validateObject({ "@type": "Article", ... });
 */
export { validateJsonLdObject as validateObject } from './validate.js';
export { extractJsonLdBlocks } from './extract.js';
import { extractJsonLdBlocks } from './extract.js';
import { validateJsonLdObject } from './validate.js';
/**
 * Extract and validate all JSON-LD blocks from raw HTML.
 * The main entry point for most use cases.
 */
export function validateHtml(html) {
    const extracted = extractJsonLdBlocks(html);
    const results = [];
    extracted.forEach((block, index) => {
        if (block.parseError) {
            results.push({
                index,
                valid: false,
                issues: [{
                        path: '$',
                        message: `Invalid JSON in JSON-LD block: ${block.parseError}`,
                        severity: 'error',
                    }],
            });
            return;
        }
        results.push(validateJsonLdObject(block.parsed, index));
    });
    const errors = results.reduce((n, r) => n + r.issues.filter(i => i.severity === 'error').length, 0);
    const warnings = results.reduce((n, r) => n + r.issues.filter(i => i.severity === 'warning').length, 0);
    return { blocks: results.length, errors, warnings, results };
}
/**
 * Get all issues across all blocks, sorted by severity (errors first).
 */
export function getIssues(result) {
    const all = result.results.flatMap(r => r.issues);
    return all.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
}
//# sourceMappingURL=index.js.map