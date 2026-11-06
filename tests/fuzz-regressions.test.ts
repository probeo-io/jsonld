import { expect, it } from 'vitest';
import { validateObject, validateHtml } from '../dist/index.js';

it('fuzz seed 117: diagnoses malformed context containers without coercing objects', () => {
  for (const container of [Object.create(null), { toString: null, valueOf: null }, [], {}, false, 0, null]) {
    const input = { '@context': { '@vocab':'https://schema.org/', name: { '@id':'name', '@container':container } }, '@type':'ExerciseGym', name:'Bridge' };
    const result = validateObject(input);
    expect(result.issues.some(issue => issue.message.includes('Unsupported term definition'))).toBe(true);
    // The JSON-representable version must also be safe through HTML parsing.
    const html = `<script type="application/ld+json">${JSON.stringify(input)}</script>`;
    expect(validateHtml(html).results[0].issues.some(issue => issue.message.includes('Unsupported term definition'))).toBe(true);
  }
});
