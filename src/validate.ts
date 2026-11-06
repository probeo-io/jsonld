import { isKnownSchemaType, schemaTypeName } from './schema-vocabulary.js';
import type { ValidationIssue, BlockResult } from './types.js';
import { SCHEMA_TYPE_MAP, isSuspiciousType } from './schema-types.js';
import { buildDocument, expand, localName, type Document, type Node } from './document.js';
import { ancestors, isA, propertyDefinition, enumerationTypes } from './model.js';
import { checkObjects, LIMITS } from './limits.js';

export function limitResult(index: number, reason: string): BlockResult {
  return { index, valid: false, issues: [{ path: '$', message: `JSON-LD validation limit exceeded: ${reason}`, severity: 'error' }] };
}
const present = (value: unknown): boolean => value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

function effectiveFields(node: Node, doc: Document): Record<string, unknown> {
  const peer = typeof node.fields['@id'] === 'string' ? doc.resolved.get(node.fields['@id']) : undefined;
  return peer?.fields ?? node.fields;
}
function valueNodes(value: unknown, doc: Document): unknown[] {
  const values: unknown[] = [];
  const pending = [value];
  const seen = new WeakSet<object>();
  while (pending.length) {
    const next = pending.pop();
    if (next && typeof next === 'object') {
      if (seen.has(next)) continue;
      seen.add(next);
      if (Array.isArray(next)) { for (let i = next.length - 1; i >= 0; --i) pending.push(next[i]); continue; }
      const fields = doc.lookup.get(next)?.fields ?? next as Record<string, unknown>;
      if ('@list' in fields || '@set' in fields) { pending.push(fields['@list'] ?? fields['@set']); continue; }
      if ('@value' in fields) { values.push(fields['@value']); continue; }
    }
    values.push(next);
  }
  return values;
}
function valueTypes(value: unknown, doc: Document): string[] {
  if (!value || typeof value !== 'object') return [];
  const node = doc.lookup.get(value);
  if (!node) return [];
  const peer = typeof node.fields['@id'] === 'string' ? doc.resolved.get(node.fields['@id']) : undefined;
  return peer?.types ?? node.types;
}
function matches(value: unknown, ranges: readonly string[], node: Node, doc: Document): boolean {
  if (value == null) return true; // JSON-LD null values are ignored.
  if (typeof value === 'string') {
    // Schema.org allows Text in place of structured values. Known enumeration
    // IRIs are the exception: validate the declared enumeration's actual class.
    const expanded = expand(value, node.context);
    const enumTypes = enumerationTypes(localName(expanded));
    if (/^https?:\/\/schema\.org\//.test(expanded) && enumTypes.length)
      return ranges.some(range => enumTypes.some(type => isA(type, range)));
    return true;
  }
  if (typeof value === 'boolean') return ranges.some(range => range === 'Boolean' || range === 'DataType');
  if (typeof value === 'number') return Number.isFinite(value) && ranges.some(range =>
    range === 'Number' || range === 'Float' || range === 'DataType' || range === 'Integer' && Number.isInteger(value));
  if (value && typeof value === 'object') {
    const types = valueTypes(value, doc);
    // Untyped objects and unresolved references carry no evidence of a mismatch.
    if (!types.length) return true;
    return ranges.some(range => types.some(type => isA(type, range)));
  }
  return false;
}
function declaredType(raw: unknown): string | string[] | undefined {
  const object = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  const type = object?.['@type'];
  return typeof type === 'string' || Array.isArray(type) && type.every(value => typeof value === 'string') ? type : undefined;
}

/** Validate a page's parsed blocks together so @id references remain page-local. */
export function validateDocument(inputs: unknown[]): BlockResult[] {
  const limit = checkObjects(inputs);
  if (limit) return inputs.map((_, index) => limitResult(index, limit));
  const doc = buildDocument(inputs);
  const results = inputs.map((raw, index): BlockResult => ({ index, type: declaredType(raw), valid: true, issues: doc.issues[index] }));
  const capped = new Set<number>();
  const addIssue = (block: number, issue: ValidationIssue) => {
    const issues = results[block].issues;
    if (issues.length >= LIMITS.issues - 1) {
      if (!capped.has(block)) { issues.splice(LIMITS.issues - 1); issues.push(...limitResult(block, 'finding count').issues); capped.add(block); }
    } else issues.push(issue);
  };
  const add = (node: Node, issue: ValidationIssue) => addIssue(node.block, issue);
  inputs.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) && raw.length === 0) addIssue(index, { path: '$', message: 'Empty or unparseable JSON-LD block', severity: 'error' });
    if (Array.isArray(raw)) raw.forEach((value, i) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) addIssue(index, { path: `$[${i}]`, message: 'JSON-LD node must be an object', severity: 'error' });
    });
  });
  for (const node of doc.nodes) {
    const { fields: own, path, types, context } = node;
    if (capped.has(node.block)) continue;
    const emit = (field: string, message: string, severity: 'error' | 'warning' = 'warning', type?: string) =>
      add(node, { path: node.paths.get(field) ?? `${path}.${field}`, message, severity, ...(type ? { type } : {}) });
    if (node.root && !context.schema && !context.partial) emit('@context', 'Missing @context — expected "https://schema.org"', 'error');
    // Value objects and containers are not schema entities.
    if ('@value' in own) {
      if (['@id','@graph','@list','@set'].some(key => key in own) || Object.keys(own).some(key => !['@value','@type','@language','@direction','@index','@context'].includes(key)))
        emit('@value', 'Invalid JSON-LD value object', 'error');
      if (own['@language'] !== undefined && typeof own['@value'] !== 'string') emit('@value', 'Language-tagged @value must be a string', 'error');
      if (own['@language'] !== undefined && own['@type'] !== undefined) emit('@value', '@value cannot declare both @language and @type', 'error');
      continue;
    }
    if ('@list' in own || '@set' in own) {
      if ('@list' in own && '@set' in own) emit('@list', 'JSON-LD object cannot contain both @list and @set', 'error');
      continue;
    }
    if (own['@id'] !== undefined && typeof own['@id'] !== 'string') emit('@id', '@id must be a string', 'error');
    if (own['@graph'] !== undefined && (!own['@graph'] || typeof own['@graph'] !== 'object' || Array.isArray(own['@graph']) && own['@graph'].some(value => !value || typeof value !== 'object' || Array.isArray(value)))) emit('@graph', '@graph must contain objects', 'error');
    if (own['@type'] !== undefined && (types.length === 0 || [own['@type']].flat().some(type => typeof type !== 'string' || !type)))
      emit('@type', '@type must be a nonempty string or array of strings', 'error');
    else if (!types.length && node.root && !('@graph' in own) && !('@id' in own)) emit('@type', 'Missing @type', 'error');
    if (!context.schema && context.partial) continue; // unknown context cannot justify schema findings
    for (const type of new Set(types)) {
      if (isKnownSchemaType(type)) continue;
      if (context.partial && !/^https?:\/\/schema\.org\//i.test(type)) continue;
      if (isSuspiciousType(type)) emit('@type', `@type "${type}" looks like a plugin/theme-specific type, not valid schema.org`, 'warning', type);
      emit('@type', `Unknown schema.org type: "${type}". If this is intentional, verify it is a valid schema.org type.`, 'warning', type);
    }
    if (context.partial) continue;
    const fields = effectiveFields(node, doc);
    const known = types.filter(isKnownSchemaType);
    const lineage = new Set(known.flatMap(type => [...ancestors(type)]));
    for (const [key, value] of Object.entries(own)) {
      if (key.startsWith('@') || !context.schema || context.partial) continue;
      // Explicit foreign vocabulary extensions are outside Schema.org coverage.
      if (/^[a-z][a-z\d+.-]*:/i.test(key)) continue;
      const definition = propertyDefinition(key);
      if (!definition) { emit(key, `Unknown schema.org property: "${key}"`); continue; }
      if (definition.supersededBy.length) emit(key, `Schema.org property "${key}" is superseded by ${definition.supersededBy.join(' or ')}`);
      if (known.length && definition.domains.length && !definition.domains.some(domain => lineage.has(domain)))
        emit(key, `Schema.org property "${key}" is not defined for ${known.join(' or ')} (expected ${definition.domains.join(' or ')})`);
      if (definition.ranges.length && valueNodes(value, doc).some(item => !matches(item, definition.ranges, node, doc)))
        emit(key, `Schema.org property "${key}" expects ${definition.ranges.join(' or ')}`);
    }
    // Apply every explicitly declared detailed profile, once per property. Never
    // inherit required rich-result fields merely from a vocabulary parent class.
    const checked = new Set<string>();
    for (const type of new Set(types)) {
      const def = SCHEMA_TYPE_MAP.get(schemaTypeName(type).toLowerCase());
      if (!def) continue;
      for (const [level, list] of [['required', def.required], ['recommended', def.recommended ?? []]] as const) {
        for (const field of list) if (!present(fields[field]) && !checked.has(field)) {
          checked.add(field);
          emit(field, `${def.guidance ?? 'Structured-data profile'}: Missing ${level} property "${field}" for ${type}`, level === 'required' ? 'error' : 'warning', type);
        }
      }
      for (const [field, validator] of Object.entries(def.fieldValidators ?? {})) {
        if (!(field in own) || checked.has(`validator:${field}`)) continue;
        checked.add(`validator:${field}`);
        const values = valueNodes(own[field], doc);
        const issue = validator(values.length === 1 ? values[0] : values, node.paths.get(field) ?? `${path}.${field}`);
        if (issue) add(node, { ...issue, type: issue.type ?? type });
      }
      for (const [field, expected] of Object.entries(def.nestedTypes ?? {})) {
        if (!(field in own) || checked.has(`nested:${field}`)) continue;
        checked.add(`nested:${field}`);
        for (const value of valueNodes(own[field], doc)) {
          const actual = valueTypes(value, doc);
          if (!actual.length || actual.some(type => expected.some(expectedType => isA(type, expectedType)))) continue;
          const child = value && typeof value === 'object' ? doc.lookup.get(value) : undefined;
          add(node, { path: child?.paths.get('@type') ?? `${child?.path ?? node.paths.get(field) ?? `${path}.${field}`}.@type`,
            message: `${def.guidance ?? 'Structured-data profile'}: Expected ${field} to be ${expected.join(' or ')}, got "${actual.join(' or ')}"`, severity: 'warning', type });
        }
      }
      if (def.type === 'BreadcrumbList' && own.itemListElement) {
        const items = valueNodes(own.itemListElement, doc);
        items.forEach((item, i) => {
          if (!item || typeof item !== 'object') return;
          const child = doc.lookup.get(item);
          if (!child || !valueTypes(item, doc).some(type => isA(type, 'ListItem'))) return;
          const childFields = effectiveFields(child, doc);
          const linked = childFields.item && typeof childFields.item === 'object' ? doc.lookup.get(childFields.item) : undefined;
          const linkedName = linked ? effectiveFields(linked, doc).name : undefined;
          if (!hasText(childFields.name) && !hasText(linkedName)) add(child, { path: `${child.path}.name`, message: 'Google eligibility (Breadcrumb): Missing required property "name" for breadcrumb ListItem', severity: 'error', type: 'ListItem' });
          if (i < items.length - 1 && !present(childFields.item)) add(child, { path: `${child.path}.item`, message: 'Google eligibility (Breadcrumb): Missing required property "item" for breadcrumb ListItem', severity: 'error', type: 'ListItem' });
        });
      }
    }
  }
  for (const result of results) {
    if (result.issues.length >= LIMITS.issues && !result.issues.some(issue => issue.message.includes('limit exceeded'))) result.issues[LIMITS.issues - 1] = limitResult(result.index, 'finding count').issues[0];
    result.valid = !result.issues.some(issue => issue.severity === 'error');
  }
  return results;
}
export function validateJsonLdObject(raw: unknown, index = 0): BlockResult {
  return { ...validateDocument([raw])[0], index };
}
