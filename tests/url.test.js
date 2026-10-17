import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, getCanonicalUrl, TRACKING_PARAMS } from '../packages/core/src/url.js';

test('URL Normalization - Protocol / Scheme stripping and HTTP/HTTPS equivalence', () => {
  // RFC Section 5: Clients MUST strip protocol scheme and leading double slashes
  assert.strictEqual(normalizeUrl('https://example.org/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('http://example.org/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('//example.org/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('http://example.com/page'), normalizeUrl('https://example.com/page'));
});

test('URL Normalization - Hostname to lowercase', () => {
  // RFC Section 5: EXAMPLE.ORG/article becomes example.org/article
  const result = normalizeUrl('HTTPS://EXAMPLE.ORG/article');
  assert.strictEqual(result, 'example.org/article');
});

test('URL Normalization - Port removal for default ports :80 and :443', () => {
  // RFC Section 5: Remove standard default ports (:80 for HTTP, :443 for HTTPS)
  assert.strictEqual(normalizeUrl('http://example.org:80/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('https://example.org:443/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('https://example.org:8080/article'), 'example.org:8080/article');
});

test('URL Normalization - Remove fragment', () => {
  // RFC Section 5: example.org/article#comments becomes example.org/article
  const result = normalizeUrl('https://example.org/article#comments');
  assert.strictEqual(result, 'example.org/article');
});

test('URL Normalization - Remove trailing slash except when root', () => {
  // RFC Section 5: example.org/article/ becomes example.org/article
  assert.strictEqual(normalizeUrl('https://example.org/article/'), 'example.org/article');
  assert.strictEqual(normalizeUrl('https://example.org/article/sub/'), 'example.org/article/sub');
  
  // Root URL retains root slash or standard URL representation
  assert.strictEqual(normalizeUrl('https://example.org/'), 'example.org/');
  assert.strictEqual(normalizeUrl('https://example.org'), 'example.org/');
});

test('URL Normalization - Remove known tracking parameters', () => {
  // RFC Section 5: utm_source, utm_medium, utm_campaign, fbclid, gclid
  const urlWithTracking = 'https://example.org/article?utm_source=twitter&utm_medium=social&utm_campaign=spring2026&fbclid=12345&gclid=67890';
  assert.strictEqual(normalizeUrl(urlWithTracking), 'example.org/article');

  // Retain non-tracking query parameters in sorted order
  const urlWithMixedParams = 'https://example.org/search?q=mudpie&utm_source=newsletter&page=2';
  assert.strictEqual(normalizeUrl(urlWithMixedParams), 'example.org/search?page=2&q=mudpie');
});

test('URL Normalization - Lexicographical query parameter sorting', () => {
  // RFC Section 5: Clients MUST sort remaining query parameters lexicographically by UTF-8 byte order (e.g. a=1&b=2)
  assert.strictEqual(normalizeUrl('https://example.org/search?b=2&a=1'), 'example.org/search?a=1&b=2');
  assert.strictEqual(normalizeUrl('https://example.org/search?sort=desc&page=2'), 'example.org/search?page=2&sort=desc');
  assert.strictEqual(normalizeUrl('https://example.org/items?z=9&a=1&m=5'), 'example.org/items?a=1&m=5&z=9');
  assert.strictEqual(
    normalizeUrl('https://example.org/search?b=2&a=1'),
    normalizeUrl('https://example.org/search?a=1&b=2')
  );
});

test('URL Normalization - Domain Name Encoding (ASCII Punycode RFC 3492)', () => {
  // RFC Section 5: Clients MUST convert hostnames to ASCII Punycode (RFC 3492) prior to hashing
  assert.strictEqual(normalizeUrl('https://münchen.de/article'), 'xn--mnchen-3ya.de/article');
  assert.strictEqual(normalizeUrl('http://xn--mnchen-3ya.de/article'), 'xn--mnchen-3ya.de/article');
  assert.strictEqual(normalizeUrl('HTTPS://MÜNCHEN.DE/article'), 'xn--mnchen-3ya.de/article');
  assert.strictEqual(normalizeUrl('https://bücher.de/shop'), 'xn--bcher-kva.de/shop');

  // Unicode and Punycode variants produce identical normalized output
  assert.strictEqual(
    normalizeUrl('https://münchen.de/article'),
    normalizeUrl('https://xn--mnchen-3ya.de/article')
  );
});

test('URL Normalization - Missing scheme auto-prepends https:// for parsing', () => {
  assert.strictEqual(normalizeUrl('example.org/article/'), 'example.org/article');
});

test('URL Normalization - Normalized and schemeless URLs', () => {
  // Verifies that already-normalized and schemeless URLs normalize idempotently and leniently
  assert.strictEqual(normalizeUrl('example.org/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('example.org/search?b=2&a=1'), 'example.org/search?a=1&b=2');
  assert.strictEqual(normalizeUrl('example.org:80/article/'), 'example.org/article');
  assert.strictEqual(normalizeUrl('example.org:443/article'), 'example.org/article');
  assert.strictEqual(normalizeUrl('xn--mnchen-3ya.de/article'), 'xn--mnchen-3ya.de/article');
  assert.strictEqual(normalizeUrl(normalizeUrl('https://example.org/article?utm_source=foo&b=2&a=1')), 'example.org/article?a=1&b=2');
});

test('URL Normalization - Non-empty string validation', () => {
  assert.throws(() => normalizeUrl(''), /URL must be a non-empty string/);
  assert.throws(() => normalizeUrl('   '), /URL must be a non-empty string/);
  assert.throws(() => normalizeUrl(null), /URL must be a non-empty string/);
  assert.throws(() => normalizeUrl(undefined), /URL must be a non-empty string/);
});

test('getCanonicalUrl - extracts canonical link from document mockup', () => {
  const fakeDoc = {
    baseURI: 'https://example.org/blog/page.html',
    querySelector(selector) {
      if (selector === 'link[rel~="canonical"]') {
        return {
          getAttribute(attr) {
            if (attr === 'href') return '/blog/post-1';
            return null;
          }
        };
      }
      return null;
    }
  };

  const canonical = getCanonicalUrl(fakeDoc, 'https://example.org/blog/page.html');
  assert.strictEqual(canonical, 'example.org/blog/post-1');
});

test('getCanonicalUrl - resolves relative canonical links against baseURI', () => {
  const fakeDoc = {
    baseURI: 'https://example.org/blog/subdir/page.html',
    querySelector(selector) {
      if (selector === 'link[rel~="canonical"]') {
        return {
          getAttribute(attr) {
            if (attr === 'href') return '../post-relative';
            return null;
          }
        };
      }
      return null;
    }
  };

  const canonical = getCanonicalUrl(fakeDoc, 'https://example.org/blog/subdir/page.html');
  assert.strictEqual(canonical, 'example.org/blog/post-relative');
});

test('getCanonicalUrl - enforces same-origin guardrail to prevent cross-site hijacking', () => {
  const fakeDoc = {
    baseURI: 'https://example.org/article',
    querySelector(selector) {
      if (selector === 'link[rel~="canonical"]') {
        return {
          getAttribute(attr) {
            // Malicious or third-party syndication cross-domain canonical target
            if (attr === 'href') return 'https://hijacker.com/stolen-article';
            return null;
          }
        };
      }
      return null;
    }
  };

  // Cross-origin canonical is rejected and falls back to the document / page URL
  const canonical = getCanonicalUrl(fakeDoc, 'https://example.org/article');
  assert.strictEqual(canonical, 'example.org/article');
});

test('getCanonicalUrl - falls back to current URL if no link tag', () => {
  const fakeDoc = {
    baseURI: 'https://example.org/about/',
    querySelector() { return null; }
  };
  const canonical = getCanonicalUrl(fakeDoc, 'https://example.org/about/');
  assert.strictEqual(canonical, 'example.org/about');
});
