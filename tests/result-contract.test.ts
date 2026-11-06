import { expect, it } from 'vitest';
import { validateHtml, validateObject } from '../src/index.js';

function exactKeys(value: object, required: string[], optional: string[] = []) {
  const keys = Object.keys(value);
  for (const key of required) expect(keys).toContain(key);
  expect(keys.filter(key => !required.includes(key) && !optional.includes(key))).toEqual([]);
}
function blockContract(block: any) {
  exactKeys(block, ['index', 'valid', 'issues'], ['type']);
  expect(Number.isInteger(block.index)).toBe(true);
  expect(block.index).toBeGreaterThanOrEqual(0);
  expect(typeof block.valid).toBe('boolean');
  expect(Array.isArray(block.issues)).toBe(true);
  if ('type' in block) expect(typeof block.type === 'string' || Array.isArray(block.type) && block.type.every((type: unknown) => typeof type === 'string')).toBe(true);
  for (const issue of block.issues) {
    exactKeys(issue, ['path', 'message', 'severity'], ['type']);
    expect(typeof issue.path).toBe('string');
    expect(issue.path.startsWith('$')).toBe(true);
    expect(typeof issue.message).toBe('string');
    expect(['error', 'warning']).toContain(issue.severity);
    if ('type' in issue) expect(typeof issue.type).toBe('string');
  }
  expect(block.valid).toBe(!block.issues.some((issue: any) => issue.severity === 'error'));
}
function resultContract(value: unknown) {
  const result = JSON.parse(JSON.stringify(value));
  exactKeys(result, ['blocks', 'errors', 'warnings', 'results']);
  expect(Array.isArray(result.results)).toBe(true);
  expect(result.blocks).toBe(result.results.length);
  result.results.forEach((block: any, index: number) => { blockContract(block); expect(block.index).toBe(index); });
  const issues = result.results.flatMap((block: any) => block.issues);
  expect(result.errors).toBe(issues.filter((issue: any) => issue.severity === 'error').length);
  expect(result.warnings).toBe(issues.filter((issue: any) => issue.severity === 'warning').length);
  return result;
}
const script = (raw: string) => `<script type="application/ld+json">${raw}</script>`;
it.each([
  '', '<p>No structured data</p>', script('{bad json}'),
  script(JSON.stringify({'@context':'https://schema.org','@type':'ExerciseGym',name:'Bridge'})),
  script(JSON.stringify({'@context':'https://schema.org','@type':'LocalBusiness'})),
  script(JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'LocalBusiness'},{'@type':'ExerciseGym'}]})),
  script(JSON.stringify({'@context':'https://schema.org','@type':'LocalBusiness',name:'Gym',address:{'@type':'PostalAddress'}})),
  script(JSON.stringify({'@context':'https://schema.org','@type':['ExerciseGym','LocalBusiness']})),
])('preserves the serialized contract for fixture %#', html => { resultContract(validateHtml(html)); });
it('preserves block order, indexes, declared type values and omitted optional fields', () => {
  const types = ['ExerciseGym','LocalBusiness'];
  const result = resultContract(validateHtml(script(JSON.stringify({'@context':'https://schema.org','@type':types}))+script('{bad json}')+script(JSON.stringify({'@context':'https://schema.org','@type':'UnknownCustomType'}))));
  expect(result.results.map((block: any) => block.index)).toEqual([0,1,2]);
  expect(result.results[0].type).toEqual(types);
  expect(result.results[1]).not.toHaveProperty('type');
  expect(result.results[1].issues[0]).not.toHaveProperty('type');
  expect(result.results[2].type).toBe('UnknownCustomType');
});
it('locks the empty HTML golden result without freezing validation findings', () => {
  expect(JSON.parse(JSON.stringify(validateHtml('')))).toEqual({blocks:0,errors:0,warnings:0,results:[]});
});
it('preserves standalone object index and type', () => {
  const block = JSON.parse(JSON.stringify(validateObject({'@context':'https://schema.org','@type':['ExerciseGym','LocalBusiness']},7)));
  blockContract(block);expect(block.index).toBe(7);expect(block.type).toEqual(['ExerciseGym','LocalBusiness']);
});
