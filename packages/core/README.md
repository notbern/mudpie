# @mudpie/core

Shared core library implementing the Mastodon URL Discussion Protocol (RFC-MUDP-0001).

## Modules

- `url.js`: Normalizes URLs, strips protocol scheme and default ports, converts hostnames to ASCII Punycode (RFC 3492), sorts query parameters lexicographically by UTF-8 byte order, removes tracking parameters (`utm_*`, `fbclid`, `gclid`), and resolves `<link rel="canonical">` against base URIs with same-origin guardrails per RFC Section 5.
- `identifier.js`: Calculates 72-bit SHA-256 Base64URL hashes and generates discussion identifiers (`MUDP_${base64url}`) and hashtags (`#MUDP_...`) per RFC Section 6 & 7.
- `post.js`: Formats compliant Mastodon posts with canonical URLs and hashtags, strips HTML safely, and verifies discussion statuses per RFC Section 8 & 13.
- `mastodon.js`: Mastodon API client for public tag timelines (`/api/v1/timelines/tag/:tag`), search, Web Share Intent generation, and client-side caching (15–60 min TTL) per RFC Section 9, 10, & 11.
- `storage.js`: Multi-backend storage manager compatible with WebExtension storage (`browser.storage.local/sync`), `localStorage`, and in-memory stores, configuring caching TTL and debounce delays.

## Usage Example

```javascript
import {
  normalizeUrl,
  generateDiscussionIdentifier,
  formatMudpPost,
  fetchDiscussion,
  createShareIntentUrl
} from './src/index.js';

// 1. Normalize canonical URL (protocol/scheme stripped for hash calculation)
const rawUrl = 'https://example.org/article';
const canonical = normalizeUrl('HTTPS://EXAMPLE.ORG/article/?utm_source=twitter#comments');
// => "example.org/article"

// 2. Generate discussion identifier (72-bit SHA-256 Base64URL)
const id = await generateDiscussionIdentifier(canonical);
// => "MUDP_2gcm_O6eB2sV"

// 3. Format compliant post (links in the post MUST be the unnormalized URL)
const postBody = await formatMudpPost({
  url: rawUrl,
  text: 'Great article on distributed protocols!'
});

// 4. Fetch discussions from Mastodon instance
const { posts } = await fetchDiscussion({
  url: canonical,
  instance: 'mastodon.social'
});
```
