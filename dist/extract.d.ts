export interface ExtractedBlock {
    raw: string;
    parsed: unknown;
    parseError?: string;
}
export declare function extractJsonLdBlocks(html: string): ExtractedBlock[];
//# sourceMappingURL=extract.d.ts.map