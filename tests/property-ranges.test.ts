import { expect, it } from 'vitest';
import { schemaPropertyRanges } from '../src/index.js';

it('exposes bundled property ranges without exposing mutable vocabulary state', () => {
  expect(schemaPropertyRanges('url')).toContain('URL');
  expect(schemaPropertyRanges('potentialAction')).toContain('Action');
  expect(schemaPropertyRanges('unknownProperty')).toBeUndefined();
  const ranges = schemaPropertyRanges('url') as string[];
  ranges.push('Injected');
  expect(schemaPropertyRanges('url')).not.toContain('Injected');
});
