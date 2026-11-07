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
export { retiredGoogleFeature } from './retired-features.js';
export type { RetiredGoogleFeature } from './retired-features.js';
import type { ValidationResult, ValidationIssue } from './types.js';
/**
 * Extract and validate all JSON-LD blocks from raw HTML.
 * The main entry point for most use cases.
 */
export declare function validateHtml(html: string): ValidationResult;
/**
 * Get all issues across all blocks, sorted by severity (errors first).
 */
export declare function getIssues(result: ValidationResult): ValidationIssue[];
//# sourceMappingURL=index.d.ts.map