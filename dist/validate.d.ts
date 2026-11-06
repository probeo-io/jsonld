import type { BlockResult } from './types.js';
export declare function limitResult(index: number, reason: string): BlockResult;
/** Validate a page's parsed blocks together so @id references remain page-local. */
export declare function validateDocument(inputs: unknown[]): BlockResult[];
export declare function validateJsonLdObject(raw: unknown, index?: number): BlockResult;
//# sourceMappingURL=validate.d.ts.map