/**
 * Mastodon URL Discussion Protocol (MUDP) - URL Normalization Module
 * Implements RFC-MUDP-0001 Section 5 (URL Normalization)
 */

/**
 * Known marketing and tracking parameters to strip during normalization.
 * Section 5: "Clients SHOULD remove known tracking query parameters."
 */
export const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'twclid',
  'ttclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'yclid',
  '_ga',
  '_gl',
  'ref_src',
  'ref_url'
]);

/**
 * Normalizes a URL string per RFC-MUDP-0001 Section 5.
 *
 * Transformations applied in order:
 * 1. Protocol / Scheme: Strip protocol scheme (http://, https://, etc.) and leading double slashes (//).
 * 2. Hostname & Domain Name Encoding: Convert hostname to lowercase ASCII Punycode (RFC 3492).
 * 3. Port: Remove standard default ports (:80 for HTTP, :443 for HTTPS).
 * 4. Fragment: Remove URL fragments (including '#').
 * 5. Trailing Slash: Remove trailing slash except when the path is root ("/").
 * 6. Tracking Parameters & Query Parameter Sorting: Remove known tracking query parameters and sort remaining query parameters lexicographically by UTF-8 byte order.
 *
 * @param {string} inputUrl - The URL to normalize.
 * @returns {string} The normalized URL string without protocol scheme.
 */
export function normalizeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new TypeError('URL must be a non-empty string');
  }

  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new TypeError('URL must be a non-empty string');
  }

  let parsed;

  try {
    // Attempt parsing directly
    if (trimmed.startsWith('//')) {
      parsed = new URL(`https:${trimmed}`);
    } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
      parsed = new URL(`https://${trimmed}`);
    } else {
      parsed = new URL(trimmed);
    }
  } catch {
    // If strict URL parsing fails, strip any leading scheme and try https://
    try {
      const stripped = trimmed.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, '').replace(/^\/+/, '');
      parsed = new URL(`https://${stripped}`);
    } catch {
      // Lenient fallback for non-standard or partially normalized inputs
      const cleaned = trimmed.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, '').replace(/^\/+/, '');
      const hashIdx = cleaned.indexOf('#');
      const withoutHash = hashIdx !== -1 ? cleaned.slice(0, hashIdx) : cleaned;
      const queryIdx = withoutHash.indexOf('?');
      let hostPath = queryIdx !== -1 ? withoutHash.slice(0, queryIdx) : withoutHash;
      let queryStr = queryIdx !== -1 ? withoutHash.slice(queryIdx + 1) : '';

      const slashIdx = hostPath.indexOf('/');
      let host = slashIdx !== -1 ? hostPath.slice(0, slashIdx) : hostPath;
      let path = slashIdx !== -1 ? hostPath.slice(slashIdx) : '/';

      host = host.toLowerCase().replace(/:(80|443)$/, '');

      if (path.length > 1 && path.endsWith('/')) {
        path = path.replace(/\/+$/, '');
      }
      if (!path) path = '/';

      let searchPart = '';
      if (queryStr) {
        try {
          const sp = new URLSearchParams(queryStr);
          const keysToDelete = [];
          for (const [k] of sp.entries()) {
            if (TRACKING_PARAMS.has(k.toLowerCase()) || k.toLowerCase().startsWith('utm_')) {
              keysToDelete.push(k);
            }
          }
          for (const k of keysToDelete) {
            sp.delete(k);
          }
          sp.sort();
          const qs = sp.toString();
          if (qs) searchPart = `?${qs}`;
        } catch {
          searchPart = `?${queryStr}`;
        }
      }

      return `${host}${path}${searchPart}`;
    }
  }

  // 1 & 2. Hostname converted to lowercase and ASCII Punycode (RFC 3492) via WHATWG URL parser
  const hostname = parsed.hostname.toLowerCase();

  // 3. Port: remove standard default ports (:80, :443)
  let port = parsed.port;
  if (port === '80' || port === '443') {
    port = '';
  }
  const hostWithPort = port ? `${hostname}:${port}` : hostname;

  // 4. Remove fragment
  parsed.hash = '';

  // 5. Tracking parameters & Query parameter sorting
  // Remove known tracking query parameters
  const searchParams = new URLSearchParams(parsed.search);
  const keysToDelete = [];
  for (const [key] of searchParams.entries()) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    searchParams.delete(key);
  }

  // Sort remaining search params lexicographically by UTF-8 byte order for deterministic output
  searchParams.sort();
  const queryString = searchParams.toString();
  const searchPart = queryString ? `?${queryString}` : '';

  // 6. Trailing slash: remove trailing slash except when path is root ("/")
  // E.g. https://example.org/article/ -> example.org/article
  // E.g. https://example.org/ -> example.org/
  // E.g. https://example.org -> example.org/
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }
  if (!pathname) {
    pathname = '/';
  }

  // Protocol / Scheme stripped output: hostWithPort + pathname + searchPart
  return `${hostWithPort}${pathname}${searchPart}`;
}

/**
 * Extracts the canonical URL from the document or DOM element.
 * Section 5: Resolves canonical tag against document's base URI with same-origin guardrails.
 *
 * @param {Document|Element|null} [doc] - The DOM document or container (defaults to global window.document)
 * @param {string} [fallbackUrl] - Fallback URL if canonical tag is missing or invalid (defaults to window.location.href)
 * @returns {string} The resolved and normalized canonical URL.
 */
export function getCanonicalUrl(doc, fallbackUrl) {
  let targetDoc = doc;
  if (!targetDoc && typeof document !== 'undefined') {
    targetDoc = document;
  }

  let defaultUrl = fallbackUrl;
  if (!defaultUrl && typeof window !== 'undefined' && window.location) {
    defaultUrl = window.location.href;
  }

  if (targetDoc && typeof targetDoc.querySelector === 'function') {
    const canonicalLink = targetDoc.querySelector('link[rel~="canonical"]');
    if (canonicalLink) {
      const href = (typeof canonicalLink.getAttribute === 'function')
        ? canonicalLink.getAttribute('href')
        : canonicalLink.href;
      if (href && typeof href === 'string' && href.trim()) {
        try {
          const baseUri = (targetDoc.baseURI && targetDoc.baseURI !== 'about:blank')
            ? targetDoc.baseURI
            : (defaultUrl || 'https://example.com');
          const resolved = new URL(href.trim(), baseUri);

          // Same-origin / same-host guardrail: verify canonical host matches document host
          let isAllowedOrigin = true;
          if (defaultUrl) {
            try {
              let defaultParsed;
              try {
                defaultParsed = new URL(defaultUrl);
              } catch {
                defaultParsed = new URL(`https://${defaultUrl.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, '').replace(/^\/+/, '')}`);
              }
              if (resolved.hostname.toLowerCase() !== defaultParsed.hostname.toLowerCase()) {
                isAllowedOrigin = false;
              }
            } catch {}
          }

          if (isAllowedOrigin) {
            return normalizeUrl(resolved.href);
          }
        } catch {
          // Fallback if parsing fails
        }
      }
    }
  }

  if (defaultUrl) {
    return normalizeUrl(defaultUrl);
  }

  throw new Error('Unable to determine canonical URL');
}
