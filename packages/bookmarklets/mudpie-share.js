/**
 * Mastodon URL Discussion Protocol (MUDP) - Share / Post Discussion Bookmarklet
 * Formats canonical URL, attaches #MUDP and #MUDP_... tags, and opens Mastodon web composer.
 */
(async function () {
  function getCanonical() {
    const link = document.querySelector('link[rel~="canonical"]');
    if (link) {
      const href = link.getAttribute('href');
      if (href && href.trim()) {
        try {
          const base = document.baseURI || window.location.href;
          const resolved = new URL(href.trim(), base);
          const current = new URL(window.location.href);
          if (resolved.hostname.toLowerCase() === current.hostname.toLowerCase()) {
            return resolved.href;
          }
        } catch {}
      }
    }
    return window.location.href;
  }

  function normalize(inputUrl) {
    try {
      const u = new URL(inputUrl, document.baseURI || window.location.href);
      const hostname = u.hostname.toLowerCase();
      let port = u.port;
      if (port === '80' || port === '443') {
        port = '';
      }
      const hostWithPort = port ? `${hostname}:${port}` : hostname;
      u.hash = '';

      const sp = new URLSearchParams(u.search);
      const toDelete = [];
      for (const [k] of sp.entries()) {
        if (k.toLowerCase().startsWith('utm_') || ['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', '_ga', '_gl'].includes(k.toLowerCase())) {
          toDelete.push(k);
        }
      }
      for (const k of toDelete) sp.delete(k);
      sp.sort();
      const qs = sp.toString();
      const searchPart = qs ? `?${qs}` : '';

      let p = u.pathname || '/';
      if (p.length > 1 && p.endsWith('/')) {
        p = p.replace(/\/+$/, '');
      }
      if (!p) p = '/';
      return `${hostWithPort}${p}${searchPart}`;
    } catch {
      return inputUrl;
    }
  }

  const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function bytesToBase64Url(bytes) {
    let result = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < len ? bytes[i + 1] : 0;
      const b2 = i + 2 < len ? bytes[i + 2] : 0;
      result += BASE64URL_CHARS[(b0 >> 2) & 0x3f];
      result += BASE64URL_CHARS[((b0 & 0x03) << 4) | ((b1 >> 4) & 0x0f)];
      if (i + 1 < len) result += BASE64URL_CHARS[((b1 & 0x0f) << 2) | ((b2 >> 6) & 0x03)];
      if (i + 2 < len) result += BASE64URL_CHARS[b2 & 0x3f];
    }
    return result;
  }

  async function sha256Base64Url(str, byteLength = 9) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const slice = new Uint8Array(buf).subarray(0, byteLength);
    return bytesToBase64Url(slice);
  }

  try {
    const rawCanonical = getCanonical();
    const normalized = normalize(rawCanonical);
    const hash = await sha256Base64Url(normalized);
    const identifier = `MUDP_${hash}`;
    const comment = prompt('Enter your comment (optional):', '') || '';

    const postParts = [];
    if (comment.trim()) {
      postParts.push(comment.trim());
      postParts.push('');
    }
    postParts.push(rawCanonical);
    postParts.push('');
    postParts.push('#MUDP\n#' + identifier);

    const postText = postParts.join('\n');
    const instance = prompt('Your Mastodon instance (e.g. fosstodon.org):', '');
    if (!instance || !instance.trim()) return;
    const cleanHost = instance.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();

    window.open(`https://${cleanHost}/share?text=${encodeURIComponent(postText)}`, '_blank', 'noopener,noreferrer');
  } catch (err) {
    alert('MUDP Error: ' + err.message);
  }
})();
