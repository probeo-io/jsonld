import { LIMITS } from './limits.js';
const schema = /^https?:\/\/schema\.org\/?$/i;
const schemaIri = /^https?:\/\/schema\.org\//i;
const keywords = new Set(['@context', '@id', '@type', '@graph', '@value', '@language', '@direction', '@index', '@list', '@set', '@included', '@nest', '@reverse']);
export const emptyContext = () => ({ terms: new Map([['schema', { id: 'https://schema.org/' }]]), schema: false, partial: false });
export function expand(value, context, vocabulary = true, seen = new Set()) {
    if (value.startsWith('@'))
        return value;
    if (schemaIri.test(value))
        return value.replace(schemaIri, 'https://schema.org/');
    if (seen.has(value) || seen.size >= LIMITS.depth)
        return value; // cyclic term definition: coverage warning is emitted by context processing
    seen.add(value);
    const term = vocabulary ? context.terms.get(value) : undefined;
    if (term?.id === null)
        return '';
    if (term?.id && term.id !== value)
        return expand(term.id, context, true, seen);
    const colon = value.indexOf(':');
    if (colon >= 0) {
        const prefix = context.terms.get(value.slice(0, colon))?.id;
        return prefix ? expand(prefix, context, true, seen) + value.slice(colon + 1) : value;
    }
    if (vocabulary && context.vocab)
        return context.vocab + value;
    if (!vocabulary && context.base) {
        try {
            return new URL(value, context.base).href;
        }
        catch { /* retain unresolved local ID */ }
    }
    return value;
}
export function localName(value) { return value.replace(schemaIri, ''); }
export function applyContext(raw, parent, path, warn) {
    if (raw === undefined)
        return parent;
    let context = { ...parent, terms: new Map(parent.terms) };
    for (const entry of Array.isArray(raw) ? raw : [raw]) {
        if (entry === null) {
            context = emptyContext();
            continue;
        }
        if (typeof entry === 'string') {
            if (schema.test(entry)) {
                context.vocab = 'https://schema.org/';
                context.schema = true;
            }
            else {
                context.partial = true;
                warn(path, `Unsupported external context "${entry}"; validation coverage is partial (remote contexts are never fetched)`);
            }
            continue;
        }
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            warn(path, 'Invalid @context: expected an object, URL or null');
            context.partial = true;
            continue;
        }
        const object = entry;
        for (const key of ['@vocab', '@base']) {
            if (!(key in object))
                continue;
            if (object[key] === null)
                context[key === '@vocab' ? 'vocab' : 'base'] = undefined;
            else if (typeof object[key] === 'string')
                context[key === '@vocab' ? 'vocab' : 'base'] = schema.test(object[key]) ? 'https://schema.org/' : object[key];
            else {
                warn(path, `Invalid ${key} in @context`);
                context.partial = true;
            }
        }
        for (const [term, definition] of Object.entries(object)) {
            if (term.startsWith('@')) {
                if (!['@vocab', '@base', '@version', '@language', '@direction', '@protected'].includes(term)) {
                    warn(path, `Unsupported context keyword ${term}; validation coverage is partial`);
                    context.partial = true;
                }
                continue;
            }
            if (!context.terms.has(term) && context.terms.size >= 256) {
                warn(path, 'Context term limit exceeded; validation coverage is partial');
                context.partial = true;
                break;
            }
            if (definition === null || typeof definition === 'string')
                context.terms.set(term, { id: definition });
            else if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
                const def = definition;
                const id = def['@id'] === null ? null : typeof def['@id'] === 'string' ? def['@id'] : term;
                context.terms.set(term, { id, context: def['@context'], valueType: typeof def['@type'] === 'string' ? def['@type'] : undefined,
                    container: typeof def['@container'] === 'string' ? def['@container'] : undefined });
                if (Object.keys(def).some(key => !['@id', '@context', '@type', '@container', '@prefix', '@protected', '@language', '@direction'].includes(key)) ||
                    def['@container'] !== undefined && (typeof def['@container'] !== 'string' || !['@set', '@list'].includes(def['@container']))) {
                    warn(path, `Unsupported term definition for "${term}"; validation coverage is partial`);
                    context.partial = true;
                }
            }
            else {
                warn(path, `Invalid context term "${term}"`);
                context.partial = true;
            }
        }
        for (const term of context.terms.keys()) {
            const seen = new Set();
            let current = term;
            while (context.terms.has(current)) {
                const id = context.terms.get(current)?.id;
                if (!id || id === current)
                    break;
                if (seen.has(current) || seen.size >= LIMITS.depth) {
                    warn(path, `Cyclic or excessive context term definition for "${term}"; validation coverage is partial`);
                    context.partial = true;
                    break;
                }
                seen.add(current);
                current = id;
            }
        }
        context.schema = context.vocab !== undefined && schema.test(context.vocab);
        if (!context.schema)
            context.schema = [...context.terms.keys()].some(term => (term !== 'schema' || Object.hasOwn(object, 'schema')) && schemaIri.test(expand(term, context)));
        if (context.vocab && !schema.test(context.vocab) && !context.schema) {
            warn(path, `Unsupported vocabulary "${context.vocab}"; validation coverage is partial`);
            context.partial = true;
        }
    }
    return context;
}
export function buildDocument(inputs) {
    const doc = { nodes: [], ids: new Map(), issues: inputs.map(() => []), lookup: new WeakMap(), resolved: new Map() };
    inputs.forEach((input, block) => {
        const visited = new WeakSet();
        const warn = (path, message) => {
            if (doc.issues[block].length < LIMITS.issues)
                doc.issues[block].push({ path, message, severity: 'warning' });
        };
        const visit = (value, path, inherited, root) => {
            if (!value || typeof value !== 'object' || visited.has(value))
                return;
            visited.add(value);
            if (Array.isArray(value)) {
                value.forEach((item, i) => visit(item, `${path}[${i}]`, inherited, root));
                return;
            }
            const raw = value;
            let context = applyContext(raw['@context'], inherited, `${path}.@context`, warn);
            const childBaseContext = context;
            // Type-scoped definitions apply to this node, not implicitly to its children.
            // Apply type-scoped contexts before resolving properties.
            const typeKey = Object.keys(raw).find(key => expand(key, context) === '@type');
            for (const type of [typeKey ? raw[typeKey] : []].flat()) {
                if (typeof type === 'string' && context.terms.get(type)?.context !== undefined)
                    context = applyContext(context.terms.get(type).context, context, `${path}.@context`, warn);
            }
            const fields = Object.create(null);
            const paths = new Map();
            for (const [key, item] of Object.entries(raw)) {
                const expanded = expand(key, context);
                if (!expanded)
                    continue;
                const field = localName(expanded);
                const resolved = field === '@type' ? (Array.isArray(item) ? item.map(type => typeof type === 'string' ? localName(expand(type, context)) : type) : typeof item === 'string' ? localName(expand(item, context)) : item)
                    : field === '@id' && typeof item === 'string' ? expand(item, context, false) : item;
                fields[field] = field in fields ? [fields[field], resolved].flat() : resolved;
                paths.set(field, `${path}.${key}`);
                if (field === '@reverse' || field === '@nest') {
                    context = { ...context, partial: true };
                    warn(`${path}.${key}`, `Unsupported JSON-LD keyword ${field}; validation coverage is partial`);
                }
                if (field.startsWith('@') && !keywords.has(field))
                    warn(`${path}.${key}`, `Unsupported JSON-LD keyword ${field}; validation coverage is partial`);
            }
            const types = [fields['@type'] ?? []].flat().filter((type) => typeof type === 'string');
            const node = { fields, paths, types, path, block, context, root };
            doc.nodes.push(node);
            doc.lookup.set(raw, node);
            if (typeof fields['@id'] === 'string') {
                const id = fields['@id'];
                const peers = doc.ids.get(id);
                if (peers)
                    peers.push(node);
                else
                    doc.ids.set(id, [node]);
            }
            for (const [key, item] of Object.entries(raw)) {
                const field = localName(expand(key, context));
                if (field === '@context' || field === '@type' || field === '@id' || field === '@value')
                    continue;
                let childContext = childBaseContext;
                if (context.terms.get(key)?.context !== undefined)
                    childContext = applyContext(context.terms.get(key).context, context, `${path}.${key}.@context`, warn);
                // Keep the established $[n] graph paths for downstream artifact locators.
                if (field === '@graph' && Array.isArray(item)) {
                    item.forEach((child, i) => visit(child, item.length > 1 ? `${path}[${i}]` : path, childContext, false));
                }
                else
                    visit(item, `${path}.${key}`, childContext, false);
            }
        };
        visit(input, '$', emptyContext(), true);
    });
    for (const [id, nodes] of doc.ids) {
        const fields = Object.create(null);
        const types = new Set();
        for (const node of nodes) {
            node.types.forEach(type => types.add(type));
            for (const [key, value] of Object.entries(node.fields))
                if (value != null && value !== '')
                    fields[key] = value;
        }
        doc.resolved.set(id, { fields, types: [...types] });
    }
    return doc;
}
//# sourceMappingURL=document.js.map