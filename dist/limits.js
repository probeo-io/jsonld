/** Deterministic work limits: no timers, workers, filesystem or network activity. */
export const LIMITS = Object.freeze({ htmlCharacters: 16_000_000, blockCharacters: 2_000_000,
    totalCharacters: 4_000_000, blocks: 256, depth: 64, nodes: 10_000, entries: 100_000,
    stringCharacters: 2_000_000, issues: 1_000 });
export function checkObjects(inputs) {
    const visited = new WeakSet();
    const pending = inputs.map(value => ({ value, depth: 0 }));
    let nodes = 0, entries = 0, characters = 0;
    while (pending.length) {
        const { value, depth } = pending.pop();
        if (typeof value === 'string') {
            characters += value.length;
            if (characters > LIMITS.totalCharacters || value.length > LIMITS.stringCharacters)
                return 'string size';
        }
        if (!value || typeof value !== 'object')
            continue;
        if (depth > LIMITS.depth)
            return 'nesting depth';
        if (visited.has(value))
            continue;
        visited.add(value);
        if (++nodes > LIMITS.nodes)
            return 'node count';
        // Stop enumeration at the budget rather than allocating Object.entries of a huge object.
        for (const key in value) {
            if (!Object.hasOwn(value, key))
                continue;
            if (++entries > LIMITS.entries)
                return 'entry count';
            characters += key.length;
            if (characters > LIMITS.totalCharacters)
                return 'string size';
            pending.push({ value: value[key], depth: depth + 1 });
        }
    }
}
//# sourceMappingURL=limits.js.map