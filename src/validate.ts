import { isKnownSchemaType, schemaTypeName } from './schema-vocabulary.js';
import type { ValidationIssue, BlockResult } from './types.js';
import { SCHEMA_TYPE_MAP, isSuspiciousType } from './schema-types.js';

function normalizeNodes(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(obj['@graph'])) return obj['@graph'] as unknown[];
  return [raw];
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateNode(node: unknown, nodeIndex: number, basePath: string, isNested = false): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    issues.push({ path: basePath, message: 'JSON-LD node must be an object', severity: 'error' });
    return issues;
  }

  const obj = node as Record<string, unknown>;
  const context = obj['@context'];
  const typeVal = obj['@type'];

  // Nested objects inherit @context from parent — only check on top-level nodes
  if (!isNested) {
    if (!context) {
      issues.push({ path: `${basePath}.@context`, message: 'Missing @context — expected "https://schema.org"', severity: 'error' });
    } else {
      const ctxStr = Array.isArray(context) ? context.join(' ') : String(context);
      if (!ctxStr.toLowerCase().includes('schema.org')) {
        issues.push({ path: `${basePath}.@context`, message: '@context does not reference schema.org', severity: 'warning' });
      }
    }
  }

  if (!typeVal) {
    issues.push({ path: `${basePath}.@type`, message: 'Missing @type', severity: 'error' });
    return issues;
  }

  const types = Array.isArray(typeVal) ? typeVal.map(String) : [String(typeVal)];
  if (!types.length) {
    issues.push({ path: `${basePath}.@type`, message: 'Missing @type', severity: 'error' });
    return issues;
  }
  for (const type of types) {
    if (isKnownSchemaType(type)) continue;
    if (isSuspiciousType(type)) {
      issues.push({ path: `${basePath}.@type`, message: `@type "${type}" looks like a plugin/theme-specific type, not valid schema.org`, severity: 'warning', type });
    }
    issues.push({ path: `${basePath}.@type`, message: `Unknown schema.org type: "${type}". If this is intentional, verify it is a valid schema.org type.`, severity: 'warning', type });
  }

  // Vocabulary membership and detailed rich-result validation are separate concerns.
  // A valid type without a rule must not acquire arbitrary requirements from an ancestor.
  const primaryType = types.find(type => SCHEMA_TYPE_MAP.has(schemaTypeName(type).toLowerCase()));
  const def = primaryType && SCHEMA_TYPE_MAP.get(schemaTypeName(primaryType).toLowerCase());
  if (!def || !primaryType) return issues;

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
      if (issue) issues.push({ ...issue, type: issue.type ?? primaryType });
    }
  }

  for (const [field, expectedTypes] of Object.entries(def.nestedTypes ?? {})) {
    if (!(field in obj) || obj[field] == null) continue;
    const nested = obj[field];
    const nestedArr = Array.isArray(nested) ? nested : [nested];
    nestedArr.forEach((item, i) => {
      if (!item || typeof item !== 'object') return;
      const itemObj = item as Record<string, unknown>;
      const nestedTypes = itemObj['@type'] ? [itemObj['@type']].flat().map(String) : [];
      const nestedType = nestedTypes[0] ?? null;
      if (nestedType && !nestedTypes.some(type => expectedTypes.some(t => t.toLowerCase() === schemaTypeName(type).toLowerCase()))) {
        issues.push({ path: `${basePath}.${field}[${i}].@type`, message: `Expected ${field} to be ${expectedTypes.join(' or ')}, got "${nestedType}"`, severity: 'warning', type: primaryType });
      }
      const nestedPath = `${basePath}.${field}${nestedArr.length > 1 ? `[${i}]` : ''}`;
      if (schemaTypeName(primaryType).toLowerCase() === 'breadcrumblist' && field === 'itemListElement' && nestedTypes.some(type => schemaTypeName(type).toLowerCase() === 'listitem')) {
        const linkedItem = itemObj.item;
        const linkedName = linkedItem && typeof linkedItem === 'object' && !Array.isArray(linkedItem)
          ? (linkedItem as Record<string, unknown>).name : undefined;
        if (!hasText(itemObj.name) && !hasText(linkedName)) {
          issues.push({ path: `${nestedPath}.name`, message: 'Missing required property "name" for breadcrumb ListItem', severity: 'error', type: 'ListItem' });
        }
        if (i < nestedArr.length - 1 && (linkedItem == null || linkedItem === '')) {
          issues.push({ path: `${nestedPath}.item`, message: 'Missing required property "item" for breadcrumb ListItem', severity: 'error', type: 'ListItem' });
        }
      }
      issues.push(...validateNode(item, nodeIndex, nestedPath, true));
    });
  }

  return issues;
}

export function validateJsonLdObject(raw: unknown, index = 0): BlockResult {
  const rawObj = raw as Record<string, unknown> | null;
  const hasGraph = rawObj && !Array.isArray(raw) && Array.isArray(rawObj['@graph']);
  const nodes = normalizeNodes(raw);
  const allIssues: ValidationIssue[] = [];

  if (nodes.length === 0) {
    allIssues.push({ path: '$', message: 'Empty or unparseable JSON-LD block', severity: 'error' });
  }

  nodes.forEach((node, i) => {
    const path = nodes.length > 1 ? `$[${i}]` : '$';
    // @graph nodes inherit @context from the parent object
    allIssues.push(...validateNode(node, i, path, hasGraph ? true : false));
  });

  const obj = Array.isArray(raw) ? raw[0] : (raw as Record<string, unknown>);
  const typeVal = obj?.['@type'];

  return {
    index,
    type: typeVal as string | string[] | undefined,
    valid: !allIssues.some(i => i.severity === 'error'),
    issues: allIssues,
  };
}
