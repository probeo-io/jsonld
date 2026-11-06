import type { ValidationIssue } from './types.js';
export interface Term {
    id: string | null;
    context?: unknown;
    valueType?: string;
    container?: string;
}
export interface Context {
    vocab?: string;
    base?: string;
    terms: Map<string, Term>;
    schema: boolean;
    partial: boolean;
}
export interface Node {
    fields: Record<string, unknown>;
    paths: Map<string, string>;
    types: string[];
    path: string;
    block: number;
    context: Context;
    root: boolean;
}
export interface Document {
    nodes: Node[];
    ids: Map<string, Node[]>;
    issues: ValidationIssue[][];
    lookup: WeakMap<object, Node>;
    resolved: Map<string, {
        fields: Record<string, unknown>;
        types: string[];
    }>;
}
export declare const emptyContext: () => Context;
export declare function expand(value: string, context: Context, vocabulary?: boolean, seen?: Set<string>): string;
export declare function localName(value: string): string;
export declare function applyContext(raw: unknown, parent: Context, path: string, warn: (path: string, message: string) => void): Context;
export declare function buildDocument(inputs: unknown[]): Document;
//# sourceMappingURL=document.d.ts.map