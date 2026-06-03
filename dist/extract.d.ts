/**
 * Extract JSON-LD blocks from raw HTML using a simple regex pass.
 * Zero dependencies — no HTML parser needed since we only care about
 * <script type="application/ld+json"> blocks.
 */
export interface ExtractedBlock {
    raw: string;
    parsed: unknown;
    parseError?: string;
}
export declare function extractJsonLdBlocks(html: string): ExtractedBlock[];
//# sourceMappingURL=extract.d.ts.map