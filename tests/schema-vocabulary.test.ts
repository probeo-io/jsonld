import { describe, expect, it } from 'vitest';
import { validateObject } from '../src/index.js';
import { SCHEMA_TYPE_MAP } from '../src/schema-types.js';
import { isKnownSchemaType } from '../src/schema-vocabulary.js';
import { SCHEMA_VOCABULARY_TYPES, SCHEMA_VOCABULARY_VERSION } from '../src/schema-vocabulary-data.js';
const node = (type: string | string[], fields = {}) => ({ '@context': 'https://schema.org', '@type': type, ...fields });

describe('Schema.org vocabulary membership is independent of detailed rules', () => {
  it('recognizes ExerciseGym without inventing rich-result requirements', () => {
    const result = validateObject(node('ExerciseGym', { name: 'Bridge Performance' }));
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
  it.each(['AutoRental', 'Dentist', 'Book', 'AudioObject', 'ProfilePage', 'ApplyAction', 'WebApplication'])(
    'does not label valid %s as unknown or plugin-specific', type => {
      const result = validateObject(node(type));
      expect(result.issues.filter(issue => issue.path.endsWith('@type'))).toEqual([]);
    },
  );
  it.each(['ExerciseGym', 'exercisegym', 'https://schema.org/ExerciseGym', 'http://schema.org/ExerciseGym', 'schema:ExerciseGym'])(
    'accepts supported Schema.org spelling %s', type => expect(isKnownSchemaType(type)).toBe(true),
  );
  it.each(['UnknownCustomType', 'name', 'Monday', 'https://example.com/ExerciseGym'])(
    'continues warning for %s rather than accepting any vocabulary term or IRI', type => {
      expect(isKnownSchemaType(type)).toBe(false);
      const result = validateObject(node(type));
      expect(result.issues.some(issue => issue.message.startsWith('Unknown schema.org type:'))).toBe(true);
      expect(result.valid).toBe(true);
    },
  );
  it('retains plugin diagnostics for genuinely unknown types', () => {
    expect(validateObject(node('SEOSchema')).issues.some(issue => issue.message.includes('plugin'))).toBe(true);
  });
  it('covers every existing detailed type in the pinned vocabulary', () => {
    expect(SCHEMA_VOCABULARY_VERSION).toBe('30.1');
    expect(SCHEMA_VOCABULARY_TYPES.length).toBe(938);
    for (const [type] of SCHEMA_TYPE_MAP) expect(isKnownSchemaType(type), type).toBe(true);
  });
  it('still enforces detailed LocalBusiness validation', () => {
    const result = validateObject(node('LocalBusiness'));
    expect(result.valid).toBe(false);
    expect(result.issues.filter(issue => issue.severity === 'error').map(issue => issue.path)).toEqual(['$.name', '$.address']);
  });
});

describe('multi-type declarations', () => {
  it('selects an available detailed rule even if an unsupported valid type is first', () => {
    const types = ['ExerciseGym', 'LocalBusiness'];
    const result = validateObject(node(types));
    expect(result.type).toEqual(types);
    expect(result.issues.some(issue => issue.message.includes('Unknown'))).toBe(false);
    expect(result.issues.some(issue => issue.path === '$.address' && issue.severity === 'error')).toBe(true);
  });
  it('reports an unknown secondary type', () => {
    const result = validateObject(node(['ExerciseGym', 'TypoGym']));
    expect(result.issues.filter(issue => issue.type === 'TypoGym')).toHaveLength(1);
  });
  it('retains known rule checks alongside an unknown type', () => {
    const result = validateObject(node(['TypoGym', 'Article']));
    expect(result.issues.some(issue => issue.type === 'TypoGym')).toBe(true);
    expect(result.issues.some(issue => issue.type === 'Article' && issue.severity === 'error')).toBe(true);
  });
  it('rejects an empty type array without crashing', () => {
    expect(validateObject(node([])).valid).toBe(false);
  });
  it('preserves breadcrumb rules for canonical IRIs and nested multi-type declarations', () => {
    const result = validateObject(node('https://schema.org/BreadcrumbList', { itemListElement: [
      { '@type': ['Thing', 'https://schema.org/ListItem'], position: 1, name: 'First' },
      { '@type': 'schema:ListItem', position: 2, name: 'Last' },
    ] }));
    expect(result.issues.some(issue => issue.path === '$.itemListElement[0].item' && issue.severity === 'error')).toBe(true);
  });
  it('matches expected nested types anywhere in the nested type array', () => {
    const result = validateObject(node('LocalBusiness', { name: 'Gym', address: { '@type': ['Thing', 'https://schema.org/PostalAddress'] } }));
    expect(result.issues.some(issue => issue.message.startsWith('Expected address'))).toBe(false);
  });
});
