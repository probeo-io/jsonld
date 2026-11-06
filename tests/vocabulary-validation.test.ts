import { describe, expect, it, vi } from 'vitest';
import { validateObject, validateHtml } from '../dist/index.js';
import { LIMITS } from '../src/limits.js';
const node = (type: string | string[], fields: Record<string, unknown> = {}) => ({ '@context': 'https://schema.org', '@type': type, ...fields });
const script = (raw: unknown) => `<script type="application/ld+json">${JSON.stringify(raw)}</script>`;
const vocabularyIssues = (raw: unknown) => validateObject(raw).issues.filter(issue => issue.message.startsWith('Schema.org') || issue.message.startsWith('Unknown schema.org'));

describe('bundled vocabulary properties, inheritance and ranges', () => {
  it('accepts ExerciseGym properties inherited through both Organization and Place', () => {
    expect(validateObject(node('ExerciseGym', {
      name: 'Bridge', telephone: '+1 555 555 5555', founder: { '@type': 'Person', name: 'Chris' },
      address: { '@type': 'PostalAddress', streetAddress: '1 Main St' },
      geo: { '@type': 'GeoCoordinates', latitude: 30, longitude: -97 },
    })).issues).toEqual(expect.not.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/not defined|Unknown|expects/) })]));
  });
  it('deduplicates diamond inheritance and does not invent Google-required fields for a subtype', () => {
    expect(validateObject(node('ExerciseGym')).issues).toEqual([]);
    const result = vocabularyIssues(node('ExerciseGym', { name: 12 }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ path: '$.name', severity: 'warning' });
  });
  it.each(['1 Main St', { '@type': 'PostalAddress', streetAddress: '1 Main St' }])('accepts alternative address ranges %#', address => {
    expect(vocabularyIssues(node('ExerciseGym', { address }))).toEqual([]);
  });
  it('accepts subclasses and multiple declared types in a range', () => {
    expect(vocabularyIssues(node('Service', { provider: { '@type': ['Place','ExerciseGym'], name: 'Gym' } }))).toEqual([]);
  });
  it('treats multi-type domains as alternatives and evaluates all detailed profiles', () => {
    expect(vocabularyIssues(node(['ExerciseGym','Book'], { isbn: '123', telephone: '555' }))).toEqual([]);
    const result = validateObject(node(['Organization','Event']));
    expect(result.issues.filter(issue => issue.path === '$.name')).toHaveLength(1);
    expect(result.issues.some(issue => issue.path === '$.startDate' && issue.severity === 'error')).toBe(true);
  });
  it('warns about unknown properties and incompatible domains without changing validity', () => {
    const result = validateObject(node('ExerciseGym', { typoName: 'Gym', isbn: '123' }));
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '$.typoName', message: 'Unknown schema.org property: "typoName"' }),
      expect.objectContaining({ path: '$.isbn', message: expect.stringContaining('not defined for ExerciseGym') }),
    ]));
  });
  it.each([123, false, { '@type': 'Product', name: 'Wrong' }])('warns about an incompatible address value %#', address => {
    expect(vocabularyIssues(node('ExerciseGym', { address }))).toContainEqual(expect.objectContaining({ path: '$.address', message: expect.stringContaining('expects') }));
  });
  it('preserves permissive Text and ignores nulls', () => {
    expect(vocabularyIssues(node('ExerciseGym', { address: 'Address pending', geo: null }))).toEqual([]);
  });
  it('checks enumeration IRIs against the allowed range', () => {
    expect(vocabularyIssues(node('Offer', { price: 1, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }))).toEqual([]);
    expect(vocabularyIssues(node('Offer', { availability: 'https://schema.org/Monday' }))).toContainEqual(expect.objectContaining({ path: '$.availability', message: expect.stringContaining('expects') }));
  });
  it('traverses typed children in fields outside the old nested rule list', () => {
    expect(vocabularyIssues(node('ExerciseGym', { founder: { '@type': 'Person', name: 'Chris', nope: 1 } })))
      .toContainEqual(expect.objectContaining({ path: '$.founder.nope' }));
  });
  it('handles prototype-like input keys without throwing', () => {
    expect(() => validateObject(JSON.parse('{"@context":"https://schema.org","@type":"__proto__","constructor":5,"__proto__":{}}'))).not.toThrow();
  });
});

describe('local contexts and source paths', () => {
  it('supports inline aliases, prefixes, @vocab and keyword aliases', () => {
    const result = validateObject({ '@context': { '@vocab': 'https://schema.org/', s: 'https://schema.org/', kind: '@type', title: 's:name', Gym: 's:ExerciseGym' }, kind: 'Gym', title: 42 });
    expect(result.issues).toEqual([expect.objectContaining({ path: '$.title', message: 'Schema.org property "name" expects Text' })]);
  });
  it('resolves forward term definitions', () => {
    expect(validateObject({ '@context': { '@vocab': 'https://schema.org/', label: 's:name', s: 'https://schema.org/' }, '@type': 'ExerciseGym', label: 'Bridge' }).issues).toEqual([]);
  });
  it('applies property-scoped contexts without leaking to siblings', () => {
    const result = validateObject({ '@context': { '@vocab': 'https://schema.org/', founder: { '@id': 'founder', '@context': { label: 'name' } } }, '@type': 'ExerciseGym', founder: { '@type': 'Person', label: 'Chris' }, employee: { '@type': 'Person', name: 'Someone', label: 'Unknown' } });
    expect(result.issues.some(issue => issue.path === '$.founder.label')).toBe(false);
    expect(result.issues.some(issue => issue.path === '$.employee.label')).toBe(true);
  });
  it('applies type-scoped contexts', () => {
    const result = validateObject({ '@context': { '@vocab': 'https://schema.org/', Gym: { '@id': 'ExerciseGym', '@context': { title: 'name' } } }, '@type': 'Gym', title: 123 });
    expect(result.issues).toContainEqual(expect.objectContaining({ path: '$.title', message: expect.stringContaining('expects Text') }));
  });
  it('resolves @base for local references across blocks', () => {
    const context = { '@vocab': 'https://schema.org/', '@base': 'https://example.com/' };
    const result = validateHtml(script({ '@context': context, '@type': 'ExerciseGym', address: { '@id': '#address' } }) + script({ '@context': context, '@id': 'https://example.com/#address', '@type': 'Product', name: 'Wrong address' }));
    expect(result.results[0].issues).toContainEqual(expect.objectContaining({ path: '$.address', message: expect.stringContaining('expects') }));
  });
  it.each(['https://example.com/context.jsonld','https://schema.org.evil.test/','file:///etc/passwd'])('reports unsupported external context without fabricated type findings: %s', context => {
    const result = validateObject({ '@context': context, '@type': 'AliasFromRemote', label: 'X' });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('Unsupported external context');
  });
  it('does not invent required findings when another context could supply aliases', () => {
    const result = validateObject({ '@context': ['https://schema.org','https://example.com/context'], '@type': 'LocalBusiness' });
    expect(result.issues.every(issue => issue.message.includes('Unsupported external context'))).toBe(true);
  });
  it('handles null context resets and explicitly foreign vocabulary properties', () => {
    const result = validateObject(node('ExerciseGym', { 'https://example.com/custom': 'Extension', founder: { '@context': null, '@id': 'https://example.com/person' } }));
    expect(result.issues).toEqual([]);
  });
  it('diagnoses cyclic term definitions instead of overflowing', () => {
    const result = validateObject({ '@context': { '@vocab': 'https://schema.org/', a: 'b', b: 'a' }, '@type': 'ExerciseGym' });
    expect(result.issues.some(issue => issue.message.includes('Cyclic'))).toBe(true);
  });
  it('reports unsupported context containers explicitly', () => {
    const result = validateObject({ '@context': { '@vocab': 'https://schema.org/', label: { '@id': 'name', '@container': '@language' } }, '@type': 'ExerciseGym', label: { en: 'Bridge' } });
    expect(result.issues.some(issue => issue.message.includes('Unsupported term definition'))).toBe(true);
    expect(result.issues.some(issue => issue.message.includes('Unknown schema.org'))).toBe(false);
  });
});

describe('references, graph nodes and value containers', () => {
  it('resolves graph references without requiring @type on reference-only nodes', () => {
    const result = validateObject({ '@context': 'https://schema.org', '@graph': [ { '@type': 'ExerciseGym', address: { '@id': '#address' } }, { '@id': '#address', '@type': 'PostalAddress', streetAddress: 'Main St' } ] });
    expect(result.issues).toEqual([]);
  });
  it('resolves shared definitions across blocks and does not fetch unresolved references', () => {
    const result = validateHtml(script(node('ExerciseGym', { address: { '@id': '#address' } })) + script(node('PostalAddress', { '@id': '#address', streetAddress: 'Main St' })) + script(node('ExerciseGym', { address: { '@id': 'https://remote.invalid/address' } })));
    expect(result.errors).toBe(0); expect(result.warnings).toBe(0);
  });
  it('uses split @id definitions to satisfy detailed required properties', () => {
    const result = validateHtml(script(node('LocalBusiness', { '@id': '#gym', name: 'Gym' })) + script({ '@context': 'https://schema.org', '@id': '#gym', address: '1 Main St' }));
    expect(result.errors).toBe(0);
  });
  it('terminates cycles and emits each physical node finding once', () => {
    const gym: any = node('ExerciseGym', { typo: 1 }); gym.parentOrganization = gym;
    const result = validateObject(gym);
    expect(result.issues.filter(issue => issue.path === '$.typo')).toHaveLength(1);
  });
  it('handles cyclic @id graph relationships without recursively expanding them', () => {
    const result = validateObject({ '@context': 'https://schema.org', '@graph': [ { '@id': '#a', '@type': 'ExerciseGym', parentOrganization: { '@id': '#b' } }, { '@id': '#b', '@type': 'ExerciseGym', parentOrganization: { '@id': '#a' } } ] });
    expect(result.issues).toEqual([]);
  });
  it.each([{ '@value': 'Gym' }, { '@list': ['Gym','Bridge'] }, { '@set': ['Gym','Bridge'] }])('accepts supported value/container forms %#', name => {
    expect(validateObject(node('ExerciseGym', { name })).issues).toEqual([]);
  });
  it('validates the contents of wrappers against ranges', () => {
    expect(validateObject(node('ExerciseGym', { name: { '@value': 42 } })).issues).toContainEqual(expect.objectContaining({ path: '$.name', message: expect.stringContaining('expects Text') }));
  });
  it('rejects invalid value objects without schema @type findings', () => {
    const result = validateObject(node('ExerciseGym', { name: { '@value': 42, '@language': 'en' } }));
    expect(result.issues.some(issue => issue.path === '$.name.@value' && issue.severity === 'error')).toBe(true);
    expect(result.issues.some(issue => issue.message.includes('Missing @type'))).toBe(false);
  });
  it('diagnoses malformed graph and type declarations', () => {
    expect(validateObject({ '@context': 'https://schema.org', '@graph': [42] }).valid).toBe(false);
    expect(validateObject(node([42] as any)).valid).toBe(false);
  });
});

describe('determinism, limits and absence of runtime IO', () => {
  it('returns byte-identical serialized results repeatedly', () => {
    const input = node(['ExerciseGym','Book'], { name: 42, typo: true, isbn: '123' });
    const expected = JSON.stringify(validateObject(input));
    for (let i = 0; i < 20; ++i) expect(JSON.stringify(validateObject(input))).toBe(expected);
  });
  it('never invokes fetch even for remote contexts or identifiers', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Network forbidden'); });
    try { validateHtml(script({ '@context': 'https://remote.invalid/context', '@id': 'https://remote.invalid/node', '@type': 'Remote' })); expect(fetch).not.toHaveBeenCalled(); }
    finally { fetch.mockRestore(); }
  });
  it('keeps the public API synchronous', () => { expect(validateObject(node('ExerciseGym'))).not.toBeInstanceOf(Promise); });
  it('accepts the depth boundary and rejects deeper objects normally', () => {
    const deep = (depth: number) => { const root: any = node('ExerciseGym'); let current = root; for (let i = 0; i < depth; ++i) { current.parentOrganization = {}; current = current.parentOrganization; } return root; };
    expect(validateObject(deep(LIMITS.depth)).issues.some(issue => issue.message.includes('limit exceeded'))).toBe(false);
    expect(validateObject(deep(LIMITS.depth + 1))).toMatchObject({ valid: false, issues: [expect.objectContaining({ message: expect.stringContaining('nesting depth') })] });
  });
  it('limits oversized HTML before extracting or parsing', () => {
    expect(validateHtml('x'.repeat(LIMITS.htmlCharacters + 1))).toMatchObject({ errors: 1, results: [expect.objectContaining({ valid: false })] });
  });
  it('limits JSON blocks and block counts', () => {
    expect(validateHtml(script(node('ExerciseGym', { name: 'x'.repeat(LIMITS.blockCharacters) }))).errors).toBe(1);
    const result = validateHtml(script(node('ExerciseGym')).repeat(LIMITS.blocks + 1));
    expect(result.results.at(-1)?.issues[0].message).toContain('block count');
  });
  it('limits node counts for the object API', () => {
    const result = validateObject(node('ExerciseGym', { values: Array.from({ length: LIMITS.nodes }, () => ({})) }));
    expect(result.issues[0].message).toContain('node count');
  });
  it('caps findings with an explicit limit diagnostic', () => {
    const result = validateObject(node('ExerciseGym', Object.fromEntries(Array.from({ length: LIMITS.issues + 10 }, (_, i) => [`typo${i}`, true]))));
    expect(result.issues.length).toBe(LIMITS.issues);
    expect(result.valid).toBe(false);
    expect(result.issues.at(-1)?.message).toContain('finding count');
  });
});

it('terminates cyclic @set containers in the object API', () => {
  const wrapper: any = {}; wrapper['@set'] = wrapper;
  expect(() => validateObject(node('ExerciseGym', { name: wrapper }))).not.toThrow();
});
it('caps malformed top-level array findings too', () => {
  const result = validateObject(Array.from({ length: LIMITS.issues + 5 }, () => 42));
  expect(result.issues).toHaveLength(LIMITS.issues);
  expect(result.issues.at(-1)?.message).toContain('finding count');
});
it('rejects oversized entry and string budgets normally', () => {
  expect(validateObject(node('ExerciseGym', { name: 'x'.repeat(LIMITS.stringCharacters + 1) })).issues[0].message).toContain('string size');
  expect(validateObject(Array.from({ length: LIMITS.entries + 1 }, () => 1)).issues[0].message).toContain('entry count');
});
it('retains explicit incompatible range findings for references across blocks', () => {
  const result = validateHtml(script(node('ExerciseGym', { address: { '@id': '#wrong' } })) + script(node('Product', { '@id': '#wrong', name: 'Product' })));
  expect(result.results[0].issues.some(issue => issue.path === '$.address' && issue.message.includes('expects'))).toBe(true);
});
it('does not treat a foreign @vocab as Schema.org', () => {
  const result = validateObject({ '@context': { '@vocab': 'https://example.com/' }, '@type': 'RemoteType', custom: 1 });
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0].message).toContain('Unsupported vocabulary');
});
it('retains detailed nested-type expectations where Schema.org permits a broader range', () => {
  const result = validateObject(node('FAQPage', { mainEntity: { '@type': 'Product', name: 'Not a question' } }));
  expect(result.issues).toContainEqual(expect.objectContaining({ path: '$.mainEntity.@type', message: expect.stringContaining('Expected mainEntity to be Question') }));
});
it('does not leak a type-scoped alias into child entities', () => {
  const result = validateObject({ '@context': { '@vocab': 'https://schema.org/', Gym: { '@id': 'ExerciseGym', '@context': { label: 'name' } } }, '@type': 'Gym', label: 'Bridge', founder: { '@type': 'Person', name: 'Chris', label: 'Unknown' } });
  expect(result.issues.some(issue => issue.path === '$.label')).toBe(false);
  expect(result.issues.some(issue => issue.path === '$.founder.label' && issue.message.includes('Unknown schema.org property'))).toBe(true);
});
it('resolves relative @id values against @base without expanding term aliases', () => {
  const context = { '@vocab': 'https://schema.org/', '@base': 'https://example.com/', address: 'https://schema.org/address' };
  const result = validateHtml(script({ '@context': context, '@type': 'ExerciseGym', address: { '@id': 'address' } }) + script({ '@context': context, '@id': 'https://example.com/address', '@type': 'Product', name: 'Wrong' }));
  expect(result.results[0].issues.some(issue => issue.path === '$.address' && issue.message.includes('expects'))).toBe(true);
});
