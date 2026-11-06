import { TYPE_PARENTS, PROPERTY_DEFINITIONS, ENUMERATION_VALUES } from './schema-model-data.js';
import { schemaTypeName } from './schema-vocabulary.js';

const classes = new Map(Object.keys(TYPE_PARENTS).map(name => [name.toLowerCase(), name]));
const ancestry = new Map<string, ReadonlySet<string>>();
export function ancestors(type: string): ReadonlySet<string> {
  const name = classes.get(schemaTypeName(type).toLowerCase()) ?? schemaTypeName(type);
  const cached = ancestry.get(name);
  if (cached) return cached;
  const found = new Set<string>();
  const pending = [name];
  while (pending.length) {
    const next = pending.pop()!;
    if (found.has(next)) continue;
    found.add(next);
    if (Object.hasOwn(TYPE_PARENTS, next)) pending.push(...TYPE_PARENTS[next]);
  }
  // Cache only bundled classes, never arbitrary names from a page.
  if (classes.has(name.toLowerCase())) ancestry.set(name, found);
  return found;
}
export const isA = (actual: string, expected: string): boolean => ancestors(actual).has(expected);
export function propertyDefinition(name: string): typeof PROPERTY_DEFINITIONS[string] | undefined {
  if (!Object.hasOwn(PROPERTY_DEFINITIONS, name)) return undefined;
  const original = PROPERTY_DEFINITIONS[name];
  const domains = new Set(original.domains), ranges = new Set(original.ranges);
  const seen = new Set<string>([name]);
  const pending = [...original.parents];
  while (pending.length) {
    const parent = pending.pop()!;
    if (seen.has(parent) || !Object.hasOwn(PROPERTY_DEFINITIONS, parent)) continue;
    seen.add(parent);
    const definition = PROPERTY_DEFINITIONS[parent];
    if (!original.domains.length) definition.domains.forEach(value => domains.add(value));
    if (!original.ranges.length) definition.ranges.forEach(value => ranges.add(value));
    pending.push(...definition.parents);
  }
  return { ...original, domains: [...domains], ranges: [...ranges] };
}
export function enumerationTypes(value: string): readonly string[] {
  return Object.hasOwn(ENUMERATION_VALUES, value) ? ENUMERATION_VALUES[value] : [];
}
