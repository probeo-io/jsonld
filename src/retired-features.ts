import { schemaTypeName } from './schema-vocabulary.js';
import type { ValidationIssue } from './types.js';

export interface RetiredGoogleFeature {
  readonly id: 'faq' | 'howto' | 'sitelinks-search-box';
  readonly schemaType: string;
  readonly label: string;
  readonly retiredOn: string;
  readonly message: string;
}

const features: readonly RetiredGoogleFeature[] = [
  {
    id: 'faq', schemaType: 'FAQPage', label: 'Google FAQ rich results are retired', retiredOn: '2026-05-07',
    message: 'Google retired FAQ rich results on May 7, 2026. FAQPage remains valid Schema.org markup; removing it is not required.',
  },
  {
    id: 'howto', schemaType: 'HowTo', label: 'Google HowTo rich results are retired', retiredOn: '2023-09-13',
    message: 'Google retired HowTo rich results on September 13, 2023. HowTo remains valid Schema.org markup; removing it is not required.',
  },
  {
    id: 'sitelinks-search-box', schemaType: 'SearchAction', label: 'Google sitelinks search box is retired', retiredOn: '2024-11-21',
    message: 'Google retired the sitelinks search box on November 21, 2024. WebSite SearchAction markup remains valid Schema.org markup; removing it is not required. Regular sitelinks and site-name support are unaffected.',
  },
];
for (const feature of features) Object.freeze(feature);

/** Type metadata alone is not a finding: SearchAction needs WebSite context. */
export function retiredGoogleFeatureForType(type: string): RetiredGoogleFeature | undefined {
  const name = schemaTypeName(type).toLowerCase();
  return features.find(feature => feature.schemaType.toLowerCase() === name);
}

/** Recognize our exact notice without adding fields to the serialized issue contract. */
export function retiredGoogleFeature(issue: Pick<ValidationIssue, 'type' | 'message'>): RetiredGoogleFeature | undefined {
  if (!issue.type) return undefined;
  const feature = retiredGoogleFeatureForType(issue.type);
  return feature?.message === issue.message ? feature : undefined;
}
