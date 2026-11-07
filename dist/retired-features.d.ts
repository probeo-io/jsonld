import type { ValidationIssue } from './types.js';
export interface RetiredGoogleFeature {
    readonly id: 'faq' | 'howto' | 'sitelinks-search-box';
    readonly schemaType: string;
    readonly label: string;
    readonly retiredOn: string;
    readonly message: string;
}
/** Type metadata alone is not a finding: SearchAction needs WebSite context. */
export declare function retiredGoogleFeatureForType(type: string): RetiredGoogleFeature | undefined;
/** Recognize our exact notice without adding fields to the serialized issue contract. */
export declare function retiredGoogleFeature(issue: Pick<ValidationIssue, 'type' | 'message'>): RetiredGoogleFeature | undefined;
//# sourceMappingURL=retired-features.d.ts.map