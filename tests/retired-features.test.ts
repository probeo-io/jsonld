import { describe, expect, it } from 'vitest';
import { retiredGoogleFeature, validateHtml, validateObject } from '../src/index.js';

const context = 'https://schema.org';
const faq = { '@context': context, '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'When are you open?', acceptedAnswer: { '@type': 'Answer', text: 'Weekdays.' } }] };
const howto = { '@context': context, '@type': 'HowTo', name: 'Open the door', step: [{ '@type': 'HowToStep', text: 'Turn the handle.' }] };
const search = { '@type': 'SearchAction', target: 'https://example.com/search?q={search_term_string}', 'query-input': 'required name=search_term_string' };
const site = (action: unknown = search) => ({ '@context': context, '@type': 'WebSite', name: 'Example', url: 'https://example.com/', potentialAction: action });
const notices = (value: unknown) => validateObject(value).issues.filter(issue => retiredGoogleFeature(issue));

describe('retired Google Search feature notices', () => {
  it.each([[faq, 'faq', '2026-05-07'], [howto, 'howto', '2023-09-13'], [site(), 'sitelinks-search-box', '2024-11-21']] as const)(
    'reports a warning for feature %# without making otherwise valid markup invalid', (value, id, date) => {
      const result = validateObject(value);
      const found = result.issues.filter(issue => retiredGoogleFeature(issue)?.id === id);
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('warning');
      expect(found[0].message).toContain('removing it is not required');
      expect(retiredGoogleFeature(found[0])?.retiredOn).toBe(date);
      expect(result.valid).toBe(true);
      expect(result.issues.some(issue => issue.message.includes('Unknown schema.org type'))).toBe(false);
    },
  );
  it('does not retire generic SearchAction, ordinary WebSite, or unrelated actions', () => {
    expect(notices({ '@context': context, ...search })).toEqual([]);
    expect(notices({ '@context': context, '@type': 'WebSite', name: 'Example' })).toEqual([]);
    expect(notices(site({ '@type': 'ReadAction', target: 'https://example.com/' }))).toEqual([]);
    expect(notices({ ...site(), '@type': 'WebPage' })).toEqual([]);
  });
  it('finds search actions in arrays and resolved page-local graph references', () => {
    expect(notices(site([{ '@type': 'ReadAction' }, search]))).toHaveLength(1);
    const raw = { '@context': context, '@graph': [{ ...site({ '@id': '#search' }), '@context': undefined }, { '@id': '#search', ...search }] };
    const found = notices(raw);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe('$[0].potentialAction');
  });
  it('supports context aliases, full Schema.org IRIs and duplicate type declarations', () => {
    const raw = { ...faq, '@context': { '@vocab': context + '/', kind: '@type', FAQ: 'https://schema.org/FAQPage' }, '@type': undefined, kind: ['FAQ', 'https://schema.org/FAQPage'] };
    expect(notices(raw)).toHaveLength(1);
    expect(notices(raw)[0].path).toBe('$.kind');
  });
  it('does not infer retirement from text, unknown contexts, foreign types or unresolved references', () => {
    for (const raw of [
      { '@context': context, '@type': 'Article', headline: 'FAQPage HowTo SearchAction' },
      { ...faq, '@context': 'https://other.example/context' },
      { ...faq, '@type': 'https://other.example/FAQPage' },
      site({ '@id': '#missing' }),
      site({ ...search, '@context': 'https://other.example/context' }),
      site({ ...search, '@type': 'https://other.example/SearchAction' }),
    ]) expect(notices(raw)).toEqual([]);
  });
  it('retains existing validation errors and preserves the exact serialized issue fields', () => {
    const result = validateObject({ '@context': context, '@type': 'FAQPage' });
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.severity === 'error' && issue.message.includes('mainEntity'))).toBe(true);
    const notice = notices(faq)[0];
    expect(Object.keys(JSON.parse(JSON.stringify(notice))).sort()).toEqual(['message', 'path', 'severity', 'type']);
    expect(retiredGoogleFeature({ ...notice, message: 'A different warning about FAQPage' })).toBeUndefined();
  });
  it('includes notices in aggregate warnings across HTML blocks', () => {
    const html = [faq, howto, site()].map(value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`).join('');
    const result = validateHtml(html);
    expect(result.results.flatMap(block => block.issues).filter(issue => retiredGoogleFeature(issue))).toHaveLength(3);
    expect(result.warnings).toBe(result.results.reduce((n, block) => n + block.issues.filter(issue => issue.severity === 'warning').length, 0));
    expect(result.errors).toBe(0);
    expect(result.results.every(block => block.valid)).toBe(true);
  });
});
