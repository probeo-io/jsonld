import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { validateHtml, validateObject } from '../../dist/index.js';

function random(seed) {
  let state = seed >>> 0;
  return n => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) % n;
  };
}
const types = ['ExerciseGym','Article','LocalBusiness','Product','Offer','FAQPage','BreadcrumbList','__proto__','constructor','schema:Person','https://schema.org/Place','TypoType'];
const keys = ['@context','@type','@id','@vocab','@base','@container','@prefix','@import','@included','@graph','@value','@list','@set','@language','@reverse','@nest','name','address','price','priceCurrency','datePublished','itemListElement','author','offers','url','__proto__','constructor','prototype','toString','valueOf','💥',''];
function generate(seed) {
  const r = random(seed);
  const pick = list => list[r(list.length)];
  const primitive = () => pick([null, true, false, 0, -1, 1.5, '', 'x', 'https://schema.org/', 'schema:Person', '#a', '__proto__', '\u0000', '\ud800', Infinity, NaN, undefined]);
  const tree = depth => {
    if (!depth || r(3) === 0) return primitive();
    if (r(3) === 0) return Array.from({ length: r(6) }, () => tree(depth - 1));
    return Object.fromEntries(Array.from({ length: r(8) }, () => [pick(keys), tree(depth - 1)]));
  };
  const context = () => pick(['https://schema.org','https://remote.invalid/context', null, tree(2),
    { '@vocab': 'https://schema.org/', kind: '@type', label: 'name', a: 'b', b: 'a' },
    { '@vocab': 'https://schema.org/', s: 'https://schema.org/', Gym: { '@id': 's:ExerciseGym', '@context': { label: 's:name' } } }]);
  const entity = () => ({ '@context': context(), '@type': pick(types), ...Object.fromEntries(Array.from({length: r(9)}, () => [pick(keys), tree(3)])) });
  const kind = seed % 8;
  if (kind === 0) return { api: 'object', input: tree(5) };
  if (kind === 1) return { api: 'object', input: entity() };
  if (kind === 2) {
    const graph = Array.from({length: r(12) + 1}, (_, i) => ({ ...entity(), '@id': '#'+r(4), address: { '@id': '#'+r(4) } }));
    return { api: 'html', input: graph.map(value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`).join('') };
  }
  if (kind === 3) {
    let text = JSON.stringify(entity());
    for (let i = 0, count = r(6) + 1; i < count; ++i) {
      const at = r(text.length + 1);
      text = text.slice(0, at) + pick(['', '}', '[', '"', '<script>', '</script>', '\u0000', '/*', '\ud800']) + text.slice(at + r(3));
    }
    const open = pick(['<script type="application/ld+json">', "<SCRIPT type='application/ld+json'>", '<script data-x=">" type="application/ld+json">', '<script type="application/ld+json"']);
    return { api: 'html', input: open + text + pick(['</script>', '</SCRIPT>', '', '</script><script type="application/ld+json">{']) };
  }
  if (kind === 4) {
    const input = entity();
    input['@context'] = 'https://schema.org';
    input['@type'] = pick(types);
    const wrapper = {};
    wrapper[pick(['@list','@set','parentOrganization','address'])] = r(2) ? wrapper : input;
    input[pick(['name','offers','price','address','itemListElement'])] = wrapper;
    return { api: 'object', input };
  }
  if (kind === 6) {
    const input = { '@context':'https://schema.org','@type':'ExerciseGym' };
    let current = input;
    for (let i = 0, depth = 60 + r(10); i < depth; ++i) {
      const next = {};
      current[pick(['address','parentOrganization','@set','@list'])] = next;
      current = next;
    }
    if (r(2)) current.address = input;
    return { api:'object', input };
  }
  if (kind === 7) {
    const input = { '@context':'https://schema.org','@type':'ExerciseGym' };
    for (let i = 0, width = 950 + r(100); i < width; ++i) input['typo'+i] = primitive();
    return { api:'object', input };
  }
  const input = { '@context': 'https://schema.org', '@type': pick(types) };
  const adversary = pick([
    Object.create(null), Object.fromEntries([['toString', null], ['valueOf', null]]),
    Array.from({length:r(4)}, () => tree(2)),
    { '@context': { p: 'p:', '@vocab': 'https://schema.org/' }, 'p:x': tree(2) },
  ]);
  for (const field of ['price','ratingValue','name','url','address']) input[field] = adversary;
  if (r(2)) input['@type'] = 'Offer';
  if (r(3) === 0) input['@context'] = { '@vocab':'https://schema.org/', name: { '@id':'name', '@container':adversary } };
  return { api: 'object', input };
}
function freeze(root) {
  const pending = [root], seen = new WeakSet();
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value); pending.push(...Object.values(value)); Object.freeze(value);
  }
}
function keysOf(value, required, optional = []) {
  assert.ok(value && typeof value === 'object');
  for (const key of required) assert.ok(Object.hasOwn(value,key), `Missing ${key}`);
  assert.ok(Object.keys(value).every(key => required.includes(key) || optional.includes(key)), 'Unexpected output field');
}
function block(value, index) {
  keysOf(value, ['index','valid','issues'], ['type']);
  assert.equal(value.index,index); assert.equal(typeof value.valid,'boolean');
  assert.ok(Array.isArray(value.issues)); assert.ok(value.issues.length <= 1000, 'Finding cap exceeded');
  if ('type' in value) assert.ok(typeof value.type === 'string' || Array.isArray(value.type) && value.type.every(type => typeof type === 'string'));
  for (const issue of value.issues) {
    keysOf(issue, ['path','message','severity'], ['type']);
    assert.equal(typeof issue.path,'string'); assert.ok(issue.path.startsWith('$'));
    assert.equal(typeof issue.message,'string'); assert.ok(['warning','error'].includes(issue.severity));
    if ('type' in issue) assert.equal(typeof issue.type,'string');
  }
  assert.equal(value.valid,!value.issues.some(issue => issue.severity === 'error'));
}
function verify(test) {
  freeze(test.input);
  const call = () => test.api === 'html' ? validateHtml(test.input) : validateObject(test.input);
  const first = JSON.stringify(call());
  assert.equal(JSON.stringify(call()),first,'Nondeterministic result');
  const result = JSON.parse(first);
  if (test.api === 'object') block(result,0);
  else {
    keysOf(result,['blocks','errors','warnings','results']);
    assert.ok(Array.isArray(result.results)); assert.equal(result.blocks,result.results.length);
    result.results.forEach(block);
    const issues = result.results.flatMap(value => value.issues);
    assert.equal(result.errors,issues.filter(issue => issue.severity === 'error').length);
    assert.equal(result.warnings,issues.filter(issue => issue.severity === 'warning').length);
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeDescriptors, 'Prototype pollution');
}
const prototypeDescriptors = Object.getOwnPropertyDescriptors(Object.prototype);
const start = Number(process.argv[2]), count = Number(process.argv[3]);
for (let i = 0; i < count; ++i) {
  const seed = (start + i) >>> 0;
  process.stdout.write(JSON.stringify({seed})+'\n'); // parent can identify even a synchronous hang
  let test;
  try { test = generate(seed); verify(test); }
  catch (error) {
    process.stderr.write(JSON.stringify({seed, api:test?.api, error:error?.stack ?? String(error), input:inspect(test?.input,{depth:8,maxArrayLength:15,maxStringLength:300})})+'\n');
    process.exit(1);
  }
}
