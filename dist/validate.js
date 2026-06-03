import { SCHEMA_TYPE_MAP, isSuspiciousType } from './schema-types.js';
function normalizeNodes(raw) {
    if (!raw || typeof raw !== 'object')
        return [];
    const obj = raw;
    if (Array.isArray(raw))
        return raw;
    if (Array.isArray(obj['@graph']))
        return obj['@graph'];
    return [raw];
}
function validateNode(node, nodeIndex, basePath) {
    const issues = [];
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
        issues.push({ path: basePath, message: 'JSON-LD node must be an object', severity: 'error' });
        return issues;
    }
    const obj = node;
    const context = obj['@context'];
    const typeVal = obj['@type'];
    if (!context) {
        issues.push({ path: `${basePath}.@context`, message: 'Missing @context — expected "https://schema.org"', severity: 'error' });
    }
    else {
        const ctxStr = Array.isArray(context) ? context.join(' ') : String(context);
        if (!ctxStr.toLowerCase().includes('schema.org')) {
            issues.push({ path: `${basePath}.@context`, message: '@context does not reference schema.org', severity: 'warning' });
        }
    }
    if (!typeVal) {
        issues.push({ path: `${basePath}.@type`, message: 'Missing @type', severity: 'error' });
        return issues;
    }
    const types = Array.isArray(typeVal) ? typeVal.map(String) : [String(typeVal)];
    const primaryType = types[0];
    if (isSuspiciousType(primaryType)) {
        issues.push({ path: `${basePath}.@type`, message: `@type "${primaryType}" looks like a plugin/theme-specific type, not valid schema.org`, severity: 'warning', type: primaryType });
    }
    const def = SCHEMA_TYPE_MAP.get(primaryType.toLowerCase());
    if (!def) {
        issues.push({ path: `${basePath}.@type`, message: `Unknown schema.org type: "${primaryType}". If this is intentional, verify it is a valid schema.org type.`, severity: 'warning', type: primaryType });
        return issues;
    }
    for (const field of def.required) {
        if (!(field in obj) || obj[field] == null || obj[field] === '') {
            issues.push({ path: `${basePath}.${field}`, message: `Missing required property "${field}" for ${primaryType}`, severity: 'error', type: primaryType });
        }
    }
    for (const field of (def.recommended ?? [])) {
        if (!(field in obj) || obj[field] == null || obj[field] === '') {
            issues.push({ path: `${basePath}.${field}`, message: `Missing recommended property "${field}" for ${primaryType}`, severity: 'warning', type: primaryType });
        }
    }
    for (const [field, validator] of Object.entries(def.fieldValidators ?? {})) {
        if (field in obj) {
            const issue = validator(obj[field], `${basePath}.${field}`);
            if (issue)
                issues.push({ ...issue, type: issue.type ?? primaryType });
        }
    }
    for (const [field, expectedTypes] of Object.entries(def.nestedTypes ?? {})) {
        if (!(field in obj) || obj[field] == null)
            continue;
        const nested = obj[field];
        const nestedArr = Array.isArray(nested) ? nested : [nested];
        nestedArr.forEach((item, i) => {
            if (!item || typeof item !== 'object')
                return;
            const itemObj = item;
            const nestedType = itemObj['@type'] ? String(itemObj['@type']) : null;
            if (nestedType && !expectedTypes.some(t => t.toLowerCase() === nestedType.toLowerCase())) {
                issues.push({ path: `${basePath}.${field}[${i}].@type`, message: `Expected ${field} to be ${expectedTypes.join(' or ')}, got "${nestedType}"`, severity: 'warning', type: primaryType });
            }
            const nestedPath = `${basePath}.${field}${nestedArr.length > 1 ? `[${i}]` : ''}`;
            issues.push(...validateNode(item, nodeIndex, nestedPath));
        });
    }
    return issues;
}
export function validateJsonLdObject(raw, index = 0) {
    const nodes = normalizeNodes(raw);
    const allIssues = [];
    if (nodes.length === 0) {
        allIssues.push({ path: '$', message: 'Empty or unparseable JSON-LD block', severity: 'error' });
    }
    nodes.forEach((node, i) => {
        const path = nodes.length > 1 ? `$[${i}]` : '$';
        allIssues.push(...validateNode(node, i, path));
    });
    const obj = Array.isArray(raw) ? raw[0] : raw;
    const typeVal = obj?.['@type'];
    return {
        index,
        type: typeVal,
        valid: !allIssues.some(i => i.severity === 'error'),
        issues: allIssues,
    };
}
//# sourceMappingURL=validate.js.map