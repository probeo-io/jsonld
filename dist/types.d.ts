export type IssueSeverity = 'error' | 'warning';
export interface ValidationIssue {
    /** Path to the field in dot notation (e.g. "$.headline", "$.offers[0].price") */
    path: string;
    /** Human-readable description of the problem */
    message: string;
    severity: IssueSeverity;
    /** The schema type this issue belongs to */
    type?: string;
}
export interface BlockResult {
    /** nth JSON-LD block on the page (0-indexed) */
    index: number;
    /** @type value(s) */
    type?: string | string[];
    /** Whether the block is valid (no errors — warnings are allowed) */
    valid: boolean;
    issues: ValidationIssue[];
}
export interface ValidationResult {
    /** Total number of JSON-LD blocks found */
    blocks: number;
    /** Total error count across all blocks */
    errors: number;
    /** Total warning count across all blocks */
    warnings: number;
    /** Per-block results */
    results: BlockResult[];
}
/** Internal schema type definition */
export interface SchemaTypeDef {
    type: string;
    required: string[];
    recommended?: string[];
    /** Field-level type validators: field name → validator fn */
    fieldValidators?: Record<string, FieldValidator>;
    /** Nested schema types: field name → expected @type(s) */
    nestedTypes?: Record<string, string[]>;
}
export type FieldValidator = (value: unknown, path: string) => ValidationIssue | null;
//# sourceMappingURL=types.d.ts.map