# Retired Google Search feature notices (0.2.1)

The validator emits non-invalidating warning notices for:

| Detected markup | Google feature | Retirement date |
| --- | --- | --- |
| `FAQPage` | FAQ rich results | May 7, 2026 |
| `HowTo` | HowTo rich results | September 13, 2023 |
| `WebSite.potentialAction` containing or referencing `SearchAction` | Sitelinks search box | November 21, 2024 |

These are feature retirements, not Schema.org type retirements. The notices explicitly say the markup remains valid Schema.org and removal is not required. Regular sitelinks, site names, generic `SearchAction`, and other action-bearing types are not retired by this rule. Existing syntax, vocabulary and detailed-profile validation is unchanged.

Detection uses the existing in-memory document model, including graph references, arrays and context aliases. It does not fetch contexts, load a DOM, read files, or create background work. Partial or foreign contexts cannot justify a retirement finding.

The result object and issue fields remain unchanged (`path`, `message`, `severity`, optional `type`). Notices have severity `warning`, contribute to the ordinary warning count, and do not invalidate a block without another error. The optional `retiredGoogleFeature(issue)` helper recognizes exact notice messages and returns immutable feature metadata so consumers can assign stable keys without adding fields to serialized results.

Signals projects notices as `jsonld:retiredRichResult:faq`, `jsonld:retiredRichResult:howto`, and `jsonld:retiredRichResult:sitelinks-search-box`, with minor legacy severity, the original locator, and the retirement explanation. Other JSON-LD finding keys remain unchanged. Warehouse schemas remain unchanged; display severity is still owned by the consuming rule policy.

Sources:

- [Google May 2026 documentation updates](https://developers.google.com/search/updates#may-2026): FAQ retirement began May 7, 2026. The earlier government/health-only eligibility is no longer current.
- [Google HowTo retirement update](https://developers.google.com/search/blog/2023/08/howto-faq-changes): September 13, 2023.
- [Google sitelinks search box retirement](https://developers.google.com/search/blog/2024/10/sitelinks-search-box): November 21, 2024, with no need to remove the markup.
