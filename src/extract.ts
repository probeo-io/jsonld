/**
 * Extract JSON-LD blocks from raw HTML using a simple regex pass.
 * Zero dependencies — no HTML parser needed since we only care about
 * <script type="application/ld+json"> blocks.
 */

const SCRIPT_RE = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export interface ExtractedBlock {
  raw: string;
  parsed: unknown;
  parseError?: string;
}

export function extractJsonLdBlocks(html: string): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match: RegExpExecArray | null;

  SCRIPT_RE.lastIndex = 0;
  while ((match = SCRIPT_RE.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      blocks.push({ raw, parsed: JSON.parse(raw) });
    } catch (e) {
      blocks.push({ raw, parsed: null, parseError: (e as Error).message });
    }
  }

  return blocks;
}
