import { describe, it, expect } from 'vitest';
import { validateHtml, validateObject, getIssues } from '../src/index.js';

function html(jsonld: object | object[]): string {
  return `<!DOCTYPE html><html><head><script type="application/ld+json">${JSON.stringify(jsonld)}</script></head><body></body></html>`;
}

// ─── HTML extraction ──────────────────────────────────────────────────────────

describe('HTML extraction', () => {
  it('finds zero blocks in plain HTML', () => {
    const r = validateHtml('<html><body><p>No JSON-LD here</p></body></html>');
    expect(r.blocks).toBe(0);
    expect(r.errors).toBe(0);
  });

  it('finds multiple blocks', () => {
    const page = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Test"}</script>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
    `;
    const r = validateHtml(page);
    expect(r.blocks).toBe(2);
  });

  it('handles invalid JSON gracefully', () => {
    const page = `<script type="application/ld+json">{invalid json}</script>`;
    const r = validateHtml(page);
    expect(r.blocks).toBe(1);
    expect(r.errors).toBeGreaterThan(0);
    expect(r.results[0].valid).toBe(false);
  });
});

// ─── Core validation ──────────────────────────────────────────────────────────

describe('Core validation', () => {
  it('passes a valid Article', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test Article',
      author: { '@type': 'Person', name: 'Jane Doe' },
      datePublished: '2024-01-15',
      image: 'https://example.com/image.jpg',
    });
    expect(r.valid).toBe(true);
    expect(r.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('flags missing @context', () => {
    const r = validateObject({ '@type': 'Article', headline: 'Test', author: 'Jane', datePublished: '2024-01-15' });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.path.includes('@context'))).toBe(true);
  });

  it('flags missing @type', () => {
    const r = validateObject({ '@context': 'https://schema.org', name: 'Test' });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.path.includes('@type'))).toBe(true);
  });

  it('flags unknown type as warning not error', () => {
    const r = validateObject({ '@context': 'https://schema.org', '@type': 'UnknownCustomType' });
    const typeIssue = r.issues.find(i => i.path.includes('@type'));
    expect(typeIssue?.severity).toBe('warning');
    expect(r.valid).toBe(true);
  });

  it('flags suspicious plugin type', () => {
    const r = validateObject({ '@context': 'https://schema.org', '@type': 'SEOSchema' });
    expect(r.issues.some(i => i.message.includes('plugin'))).toBe(true);
  });
});

// ─── Required field validation ────────────────────────────────────────────────

describe('Required fields', () => {
  it('flags missing required fields on Article', () => {
    const r = validateObject({ '@context': 'https://schema.org', '@type': 'Article' });
    const errorFields = r.issues.filter(i => i.severity === 'error').map(i => i.path);
    expect(errorFields.some(p => p.includes('headline'))).toBe(true);
    expect(errorFields.some(p => p.includes('author'))).toBe(true);
    expect(errorFields.some(p => p.includes('datePublished'))).toBe(true);
  });

  it('flags missing required fields on Product', () => {
    const r = validateObject({ '@context': 'https://schema.org', '@type': 'Product' });
    expect(r.issues.some(i => i.path.includes('name') && i.severity === 'error')).toBe(true);
  });

  it('flags missing required fields on FAQPage', () => {
    const r = validateObject({ '@context': 'https://schema.org', '@type': 'FAQPage' });
    expect(r.issues.some(i => i.path.includes('mainEntity') && i.severity === 'error')).toBe(true);
  });

  it('flags missing required fields on JobPosting', () => {
    const r = validateObject({ '@context': 'https://schema.org', '@type': 'JobPosting' });
    const errorFields = r.issues.filter(i => i.severity === 'error').map(i => i.path);
    expect(errorFields.some(p => p.includes('title'))).toBe(true);
    expect(errorFields.some(p => p.includes('datePosted'))).toBe(true);
  });

  it('passes when all required fields present on BreadcrumbList', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' }],
    });
    expect(r.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });
});

// ─── Field validators ─────────────────────────────────────────────────────────

describe('Field validators', () => {
  it('flags non-URL in url field', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      url: 'not-a-url',
    });
    expect(r.issues.some(i => i.path.includes('url') && i.severity === 'warning')).toBe(true);
  });

  it('flags invalid date in datePublished', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      author: 'Jane',
      datePublished: 'January 2024',
    });
    expect(r.issues.some(i => i.path.includes('datePublished'))).toBe(true);
  });

  it('passes valid ISO date', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      author: 'Jane',
      datePublished: '2024-01-15T10:00:00Z',
    });
    expect(r.issues.filter(i => i.path.includes('datePublished') && i.severity === 'error')).toHaveLength(0);
  });

  it('flags negative price', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Offer',
      price: -5,
      priceCurrency: 'USD',
    });
    expect(r.issues.some(i => i.path.includes('price'))).toBe(true);
  });
});

// ─── @graph support ───────────────────────────────────────────────────────────

describe('@graph support', () => {
  it('validates nodes inside @graph', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Acme' },
        { '@type': 'Organization', name: 'Acme Corp', url: 'https://acme.com' },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('flags errors inside @graph', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Article' }, // missing required fields
      ],
    });
    expect(r.valid).toBe(false);
  });
});

// ─── Recommended fields ───────────────────────────────────────────────────────

describe('Recommended fields', () => {
  it('warns on missing recommended image for Article', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      author: 'Jane',
      datePublished: '2024-01-15',
    });
    expect(r.valid).toBe(true);
    expect(r.issues.some(i => i.path.includes('image') && i.severity === 'warning')).toBe(true);
  });

  it('does not warn on recommended fields that are present', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      url: 'https://acme.com',
      logo: 'https://acme.com/logo.png',
    });
    expect(r.issues.filter(i => i.path.includes('url') || i.path.includes('logo'))).toHaveLength(0);
  });
});

// ─── getIssues helper ─────────────────────────────────────────────────────────

describe('getIssues', () => {
  it('returns errors before warnings', () => {
    const r = validateHtml(html({ '@context': 'https://schema.org', '@type': 'Article' }));
    const issues = getIssues(r);
    const firstWarningIdx = issues.findIndex(i => i.severity === 'warning');
    const lastErrorIdx = issues.map(i => i.severity).lastIndexOf('error');
    if (firstWarningIdx !== -1 && lastErrorIdx !== -1) {
      expect(lastErrorIdx).toBeLessThan(firstWarningIdx);
    }
  });
});

// ─── Real-world schema types ──────────────────────────────────────────────────

describe('Real-world schema types', () => {
  it('validates a valid Event', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Annual Conference',
      startDate: '2024-06-15T09:00:00',
      location: { '@type': 'Place', name: 'Convention Center' },
    });
    expect(r.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('validates a valid LocalBusiness', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Joe\'s Diner',
      address: { '@type': 'PostalAddress', streetAddress: '123 Main St', addressLocality: 'Springfield' },
    });
    expect(r.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('validates a valid VideoObject', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'How to cook pasta',
      description: 'Step by step pasta tutorial',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      uploadDate: '2024-01-15',
    });
    expect(r.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('validates a FAQPage with nested Questions', () => {
    const r = validateObject({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is schema.org?',
          acceptedAnswer: { '@type': 'Answer', text: 'A vocabulary for structured data.' },
        },
      ],
    });
    expect(r.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });
});
