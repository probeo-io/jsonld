/** Deterministic work limits: no timers, workers, filesystem or network activity. */
export declare const LIMITS: Readonly<{
    htmlCharacters: 16000000;
    blockCharacters: 2000000;
    totalCharacters: 4000000;
    blocks: 256;
    depth: 64;
    nodes: 10000;
    entries: 100000;
    stringCharacters: 2000000;
    issues: 1000;
}>;
export declare function checkObjects(inputs: unknown[]): string | undefined;
//# sourceMappingURL=limits.d.ts.map