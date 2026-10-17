/**
 * Mastodon URL Discussion Protocol (MUDP) - Content Script
 * Extracts canonical URL from the document and communicates with background/popup.
 */

(function () {
  /**
   * Known tracking parameters to strip during normalization in content script.
   */
  const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
    'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'ttclid',
    'mc_cid', 'mc_eid', 'igshid', 'yclid', '_ga', '_gl', 'ref_src', 'ref_url'
  ]);

  function normalizeUrlFallback(inputUrl) {
    if (!inputUrl) return '';
    try {
      const parsed = new URL(inputUrl, document.baseURI || window.location.href);
      const hostname = parsed.hostname.toLowerCase();
      let port = parsed.port;
      if (port === '80' || port === '443') {
        port = '';
      }
      const hostWithPort = port ? `${hostname}:${port}` : hostname;
      parsed.hash = '';

      const searchParams = new URLSearchParams(parsed.search);
      const toDelete = [];
      for (const [k] of searchParams.entries()) {
        if (TRACKING_PARAMS.has(k.toLowerCase()) || k.toLowerCase().startsWith('utm_')) {
          toDelete.push(k);
        }
      }
      for (const k of toDelete) searchParams.delete(k);
      searchParams.sort();
      const qs = searchParams.toString();
      const searchPart = qs ? `?${qs}` : '';

      let pathname = parsed.pathname || '/';
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.replace(/\/+$/, '');
      }
      if (!pathname) {
        pathname = '/';
      }
      return `${hostWithPort}${pathname}${searchPart}`;
    } catch {
      return inputUrl;
    }
  }

  function extractPageDetails() {
    let canonical = '';
    const canonicalLink = document.querySelector('link[rel~="canonical"]');
    if (canonicalLink) {
      const href = canonicalLink.getAttribute('href');
      if (href && href.trim()) {
        try {
          const base = document.baseURI || window.location.href;
          const resolved = new URL(href.trim(), base);
          const current = new URL(window.location.href);
          // Same-origin / same-host guardrail
          if (resolved.hostname.toLowerCase() === current.hostname.toLowerCase()) {
            canonical = resolved.href;
          }
        } catch {}
      }
    }

    if (!canonical) {
      canonical = window.location.href;
    }

    const normalized = normalizeUrlFallback(canonical);

    return {
      title: document.title || '',
      canonicalUrl: normalized,
      rawUrl: window.location.href,
      hasCanonicalTag: Boolean(canonicalLink)
    };
  }

  const runtime = (typeof browser !== 'undefined' && browser.runtime)
    ? browser.runtime
    : (typeof chrome !== 'undefined' && chrome.runtime)
      ? chrome.runtime
      : null;

  if (runtime) {
    // Listen for requests from popup or background
    runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.type === 'MUDP_GET_PAGE_INFO') {
        const info = extractPageDetails();
        sendResponse(info);
        return true;
      }
    });
  }
})();
