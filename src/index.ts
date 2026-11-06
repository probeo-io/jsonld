/**
 * @probeo/jsonld — Fast, zero-dependency JSON-LD validator.
 *
 * Validates bundled Schema.org vocabulary and selected detailed profiles.
 *
 * Usage:
 *   import { validateHtml, validateObject } from "@probeo/jsonld";
 *
 *   const result = validateHtml(html);
 *   const result = validateObject({ "@type": "Article", ... });
 */

export type { ValidationIssue, BlockResult, ValidationResult, IssueSeverity } from './types.js';
export { validateJsonLdObject as validateObject } from './validate.js';
export { extractJsonLdBlocks } from './extract.js';

import { extractJsonLdBlocks } from './extract.js';
import { validateDocument, limitResult } from './validate.js';
import { LIMITS } from './limits.js';
import type { ValidationResult, BlockResult, ValidationIssue } from './types.js';

/**
 * Extract and validate all JSON-LD blocks from raw HTML.
 * The main entry point for most use cases.
 */
export function validateHtml(html: string): ValidationResult {
  if (html.length > LIMITS.htmlCharacters) return { blocks: 1, errors: 1, warnings: 0, results: [limitResult(0, 'HTML size')] };
  const extracted = extractJsonLdBlocks(html);
  const validated = validateDocument(extracted.map(block => block.parsed));
  const results: BlockResult[] = [];

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
    results.push(validated[index]);
  });

  const errors = results.reduce((n, r) => n + r.issues.filter(i => i.severity === 'error').length, 0);
  const warnings = results.reduce((n, r) => n + r.issues.filter(i => i.severity === 'warning').length, 0);

  return { blocks: results.length, errors, warnings, results };
}

/**
 * Get all issues across all blocks, sorted by severity (errors first).
 */
export function getIssues(result: ValidationResult): ValidationIssue[] {
  const all = result.results.flatMap(r => r.issues);
  return all.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
}
