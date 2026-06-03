import type { SchemaTypeDef, FieldValidator, ValidationIssue } from './types.js';

// ─── Field validators ────────────────────────────────────────────────────────

function isUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // Accept absolute URLs and protocol-relative URLs (//cdn.example.com)
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//');
}

function isDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}(T[\d:+Z.-]+)?$/.test(value);
}

function urlValidator(field: string): FieldValidator {
  return (value, path) => {
    if (value == null) return null;
    const vals = Array.isArray(value) ? value : [value];
    for (const v of vals) {
      if (typeof v === 'object' && v !== null) continue; // nested object (e.g. ImageObject), skip
      if (!isUrl(v)) {
        return { path, message: `'${field}' should be a URL`, severity: 'warning', type: field };
      }
    }
    return null;
  };
}

function dateValidator(field: string): FieldValidator {
  return (value, path) => {
    if (value == null) return null;
    if (!isDateString(value)) {
      return { path, message: `'${field}' should be an ISO 8601 date string (e.g. "2024-01-15")`, severity: 'warning' };
    }
    return null;
  };
}

function positiveNumberValidator(field: string): FieldValidator {
  return (value, path) => {
    if (value == null) return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof num !== 'number' || isNaN(num) || num < 0) {
      return { path, message: `'${field}' should be a positive number`, severity: 'warning' };
    }
    return null;
  };
}

// ─── Schema type definitions ─────────────────────────────────────────────────

const SCHEMA_TYPES: SchemaTypeDef[] = [
  // ── Content types ──────────────────────────────────────────────────────────
  {
    type: 'Article',
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'dateModified', 'publisher', 'description'],
    fieldValidators: {
      datePublished: dateValidator('datePublished'),
      dateModified: dateValidator('dateModified'),
      url: urlValidator('url'),
      image: urlValidator('image'),
    },
  },
  {
    type: 'BlogPosting',
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'dateModified', 'publisher', 'description'],
    fieldValidators: {
      datePublished: dateValidator('datePublished'),
      dateModified: dateValidator('dateModified'),
      url: urlValidator('url'),
      image: urlValidator('image'),
    },
  },
  {
    type: 'NewsArticle',
    required: ['headline', 'author', 'datePublished', 'image'],
    recommended: ['dateModified', 'publisher', 'description'],
    fieldValidators: {
      datePublished: dateValidator('datePublished'),
      dateModified: dateValidator('dateModified'),
      url: urlValidator('url'),
      image: urlValidator('image'),
    },
  },

  // ── Commerce ───────────────────────────────────────────────────────────────
  {
    type: 'Product',
    required: ['name'],
    recommended: ['description', 'image', 'offers', 'aggregateRating', 'sku', 'brand'],
    fieldValidators: {
      image: urlValidator('image'),
      url: urlValidator('url'),
    },
    nestedTypes: {
      offers: ['Offer', 'AggregateOffer'],
      aggregateRating: ['AggregateRating'],
      brand: ['Brand', 'Organization'],
    },
  },
  {
    type: 'Offer',
    required: ['price', 'priceCurrency'],
    recommended: ['availability', 'url', 'validFrom', 'priceValidUntil'],
    fieldValidators: {
      price: positiveNumberValidator('price'),
      url: urlValidator('url'),
    },
  },

  // ── Organization ───────────────────────────────────────────────────────────
  {
    type: 'Organization',
    required: ['name'],
    recommended: ['url', 'logo', 'contactPoint', 'sameAs', 'address'],
    fieldValidators: {
      url: urlValidator('url'),
      logo: urlValidator('logo'),
    },
  },
  {
    type: 'LocalBusiness',
    required: ['name', 'address'],
    recommended: ['telephone', 'url', 'openingHours', 'geo', 'image', 'priceRange', 'aggregateRating'],
    fieldValidators: {
      url: urlValidator('url'),
      image: urlValidator('image'),
    },
    nestedTypes: {
      address: ['PostalAddress'],
      aggregateRating: ['AggregateRating'],
    },
  },

  // ── People ─────────────────────────────────────────────────────────────────
  {
    type: 'Person',
    required: ['name'],
    recommended: ['url', 'image', 'jobTitle', 'worksFor', 'sameAs'],
    fieldValidators: {
      url: urlValidator('url'),
      image: urlValidator('image'),
    },
  },

  // ── Pages ──────────────────────────────────────────────────────────────────
  {
    type: 'WebSite',
    required: ['name'],
    recommended: ['url', 'potentialAction'],
    fieldValidators: { url: urlValidator('url') },
  },
  {
    type: 'WebPage',
    required: ['name'],
    recommended: ['url', 'description', 'breadcrumb'],
    fieldValidators: { url: urlValidator('url') },
  },
  {
    type: 'AboutPage',
    required: ['name'],
    recommended: ['url', 'description'],
    fieldValidators: { url: urlValidator('url') },
  },
  {
    type: 'ContactPage',
    required: ['name'],
    recommended: ['url', 'description'],
    fieldValidators: { url: urlValidator('url') },
  },
  {
    type: 'FAQPage',
    required: ['mainEntity'],
    nestedTypes: { mainEntity: ['Question'] },
  },
  {
    type: 'Question',
    required: ['name', 'acceptedAnswer'],
    nestedTypes: { acceptedAnswer: ['Answer'] },
  },

  // ── Navigation ─────────────────────────────────────────────────────────────
  {
    type: 'BreadcrumbList',
    required: ['itemListElement'],
    nestedTypes: { itemListElement: ['ListItem'] },
  },
  {
    type: 'ListItem',
    required: ['position'],
    // name can live directly on ListItem OR on the nested item object — both are valid
    recommended: ['name', 'item'],
  },

  // ── How-to ─────────────────────────────────────────────────────────────────
  {
    type: 'HowTo',
    required: ['name', 'step'],
    recommended: ['image', 'totalTime', 'estimatedCost', 'description'],
    fieldValidators: { image: urlValidator('image') },
    nestedTypes: { step: ['HowToStep', 'HowToSection'] },
  },
  {
    type: 'HowToStep',
    required: ['text'],
    recommended: ['name', 'image', 'url'],
    fieldValidators: { url: urlValidator('url'), image: urlValidator('image') },
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type: 'Event',
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'description', 'image', 'url', 'offers', 'performer', 'organizer', 'eventStatus', 'eventAttendanceMode'],
    fieldValidators: {
      startDate: dateValidator('startDate'),
      endDate: dateValidator('endDate'),
      url: urlValidator('url'),
      image: urlValidator('image'),
    },
    nestedTypes: {
      location: ['Place', 'VirtualLocation'],
      offers: ['Offer'],
    },
  },

  // ── Reviews ────────────────────────────────────────────────────────────────
  {
    type: 'Review',
    required: ['reviewRating', 'author'],
    recommended: ['reviewBody', 'datePublished', 'itemReviewed'],
    nestedTypes: { reviewRating: ['Rating'] },
  },
  {
    type: 'AggregateRating',
    // Google accepts reviewCount OR ratingCount — both are valid
    required: ['ratingValue'],
    recommended: ['reviewCount', 'bestRating', 'worstRating'],
    fieldValidators: {
      ratingValue: positiveNumberValidator('ratingValue'),
      reviewCount: positiveNumberValidator('reviewCount'),
      ratingCount: positiveNumberValidator('ratingCount'),
    },
  },

  // ── Media ──────────────────────────────────────────────────────────────────
  {
    type: 'VideoObject',
    required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'embedUrl', 'duration', 'publisher'],
    fieldValidators: {
      thumbnailUrl: urlValidator('thumbnailUrl'),
      contentUrl: urlValidator('contentUrl'),
      embedUrl: urlValidator('embedUrl'),
      uploadDate: dateValidator('uploadDate'),
    },
  },
  {
    type: 'ImageObject',
    required: ['url'],
    recommended: ['width', 'height', 'caption'],
    fieldValidators: { url: urlValidator('url') },
  },

  // ── Jobs ───────────────────────────────────────────────────────────────────
  {
    type: 'JobPosting',
    required: ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation'],
    recommended: ['employmentType', 'validThrough', 'baseSalary', 'experienceRequirements'],
    fieldValidators: {
      datePosted: dateValidator('datePosted'),
      validThrough: dateValidator('validThrough'),
    },
    nestedTypes: {
      hiringOrganization: ['Organization'],
      jobLocation: ['Place'],
    },
  },

  // ── Recipe ─────────────────────────────────────────────────────────────────
  {
    type: 'Recipe',
    required: ['name', 'image', 'author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions'],
    recommended: ['prepTime', 'cookTime', 'totalTime', 'recipeYield', 'nutrition', 'aggregateRating'],
    fieldValidators: {
      image: urlValidator('image'),
      datePublished: dateValidator('datePublished'),
    },
    nestedTypes: { aggregateRating: ['AggregateRating'] },
  },

  // ── Software ───────────────────────────────────────────────────────────────
  {
    type: 'SoftwareApplication',
    required: ['name', 'operatingSystem', 'applicationCategory'],
    recommended: ['offers', 'aggregateRating', 'screenshot', 'softwareVersion'],
    fieldValidators: { screenshot: urlValidator('screenshot') },
    nestedTypes: {
      offers: ['Offer'],
      aggregateRating: ['AggregateRating'],
    },
  },

  // ── Course ─────────────────────────────────────────────────────────────────
  {
    type: 'Course',
    required: ['name', 'description', 'provider'],
    recommended: ['url', 'hasCourseInstance', 'offers', 'aggregateRating'],
    fieldValidators: { url: urlValidator('url') },
    nestedTypes: { provider: ['Organization'] },
  },

  // ── Service ────────────────────────────────────────────────────────────────
  {
    type: 'Service',
    required: ['name'],
    recommended: ['description', 'provider', 'url', 'areaServed', 'offers', 'aggregateRating'],
    fieldValidators: { url: urlValidator('url') },
  },
];

export const SCHEMA_TYPE_MAP = new Map<string, SchemaTypeDef>(
  SCHEMA_TYPES.map((def) => [def.type.toLowerCase(), def])
);

const SUSPICIOUS_PATTERNS = ['app', 'seo', 'tapita', 'booster', 'plugin', 'extension', 'theme'];

export function isSuspiciousType(type: string): boolean {
  const lower = type.toLowerCase();
  return SUSPICIOUS_PATTERNS.some((p) => lower.includes(p));
}
