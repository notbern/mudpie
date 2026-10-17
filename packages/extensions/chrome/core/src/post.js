/**
 * Mastodon URL Discussion Protocol (MUDP) - Post Formatting and Validation
 * Implements RFC-MUDP-0001 Section 8 (Post Format) & Section 13 (Collision Handling)
 */

import { PROTOCOL_HASHTAG, getDiscussionHashtag, generateDiscussionIdentifier, parseDiscussionIdentifier } from './identifier.js';
import { normalizeUrl } from './url.js';

/**
 * Formats a MUDP-compliant Mastodon post content.
 * RFC Section 8:
 * "A MUDP-compliant post MUST contain:
 * 1. The unnormalized URL. Links in the post MUST be the unnormalized URL.
 * 2. The hashtag #MUDP.
 * 3. The discussion hashtag."
 *
 * @param {Object} options
 * @param {string} options.url - The unnormalized URL being discussed.
 * @param {string} [options.text] - User comment text.
 * @param {string} [options.identifier] - Precomputed discussion identifier (optional).
 * @returns {Promise<string>} The formatted post body.
 */
export async function formatMudpPost({ url, text = '', identifier }) {
  if (!url) {
    throw new TypeError('URL is required to format a MUDP post');
  }

  const normalized = normalizeUrl(url);
  const discussionId = identifier || (await generateDiscussionIdentifier(normalized));
  const discussionTag = getDiscussionHashtag(discussionId);

  const parts = [];
  const trimmedText = text.trim();
  if (trimmedText) {
    parts.push(trimmedText);
    parts.push(''); // blank line
  }

  parts.push(url.trim());
  parts.push(''); // blank line
  parts.push(`${PROTOCOL_HASHTAG}\n${discussionTag}`);

  return parts.join('\n');
}

/**
 * Strips HTML tags safely for text extraction from Mastodon status contents.
 *
 * @param {string} html - HTML string.
 * @returns {string} Plain text.
 */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Parses and verifies whether a Mastodon post matches the MUDP specification.
 *
 * @param {Object} status - Mastodon Status entity from API.
 * @param {string} [expectedIdentifier] - Expected discussion identifier (optional).
 * @returns {{
 *   isMudp: boolean,
 *   discussionIdentifier: string|null,
 *   url: string|null,
 *   userComment: string
 * }}
 */
export function parseAndVerifyMudpPost(status, expectedIdentifier = null) {
  if (!status || typeof status !== 'object') {
    return { isMudp: false, discussionIdentifier: null, url: null, userComment: '' };
  }

  // Check tags in status metadata if available
  const rawTags = (status.tags || []).map(t => (typeof t === 'string' ? t : t.name));
  const hasProtocolTag = rawTags.some(t => (t || '').toLowerCase() === 'mudp');

  const contentText = stripHtml(status.content || '');

  // Find discussion tag
  let foundIdentifier = null;
  for (const tag of rawTags) {
    const parsed = parseDiscussionIdentifier(tag);
    if (parsed) {
      foundIdentifier = `MUDP_${parsed}`;
      break;
    }
  }

  // Fallback regex search on text content if tags array wasn't populated
  if (!foundIdentifier) {
    const match = contentText.match(/#MUDP_([A-Za-z0-9_-]{12})/i);
    if (match) {
      foundIdentifier = `MUDP_${match[1]}`;
    }
  }

  const isProtocolPresent = hasProtocolTag || /#MUDP\b/i.test(contentText);
  const isMudp = Boolean(isProtocolPresent && foundIdentifier);

  if (!isMudp) {
    return { isMudp: false, discussionIdentifier: null, url: null, userComment: '' };
  }

  // Extract URLs from content (supports schemes as well as schemeless/normalized URLs)
  const urlRegex = /(?:https?:\/\/|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/|\b))[^\s<>"']*/gi;
  const urls = contentText.match(urlRegex) || [];
  const foundUrl = urls.length > 0 ? urls[0] : null;

  let matchesIdentifier = true;
  if (expectedIdentifier) {
    const cleanExpected = expectedIdentifier.replace(/^#/, '');
    matchesIdentifier = foundIdentifier.toLowerCase() === cleanExpected.toLowerCase();
  }

  // Extract user comment part (strip URL and hashtags)
  let cleanComment = contentText
    .replace(/#MUDP(_[A-Za-z0-9_-]{12})?/gi, '')
    .replace(/(?:https?:\/\/|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/|\b))[^\s<>"']*/gi, '')
    .trim();

  return {
    isMudp: isMudp && matchesIdentifier,
    discussionIdentifier: foundIdentifier,
    url: foundUrl,
    userComment: cleanComment
  };
}
