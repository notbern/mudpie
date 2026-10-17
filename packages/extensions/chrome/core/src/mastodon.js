/**
 * Mastodon URL Discussion Protocol (MUDP) - Mastodon API Client
 * Implements RFC-MUDP-0001 Section 9 (Discovery) & Section 10 (Local Discovery)
 */

import { formatMudpPost, parseAndVerifyMudpPost } from './post.js';
import { generateDiscussionIdentifier } from './identifier.js';

export const DEFAULT_INSTANCE = '';
export const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (RFC-MUDP-0001 Section 11: 15–60 minute TTL)

// In-memory discussion cache: Map<string, { timestamp: number, data: Object }>
const discussionCache = new Map();

/**
 * Generates a cache key for discussion lookups.
 * @param {string} identifier
 * @param {string} instance
 * @returns {string}
 */
export function getDiscussionCacheKey(identifier, instance = '') {
  const host = normalizeInstance(instance);
  const cleanTag = (identifier || '').replace(/^#/, '').toLowerCase();
  return `${host}:${cleanTag}`;
}

/**
 * Retrieves a cached discussion result if fresh.
 *
 * @param {string} identifier - MUDP discussion identifier.
 * @param {string} [instance] - Mastodon instance.
 * @param {number} [maxAgeMs] - Maximum cache age in milliseconds (default: 30 minutes).
 * @returns {Object|null} Cached discussion result or null if missing/expired.
 */
export function getCachedDiscussion(identifier, instance = '', maxAgeMs = DEFAULT_CACHE_TTL_MS) {
  const key = getDiscussionCacheKey(identifier, instance);
  const entry = discussionCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > maxAgeMs) {
    discussionCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Stores a discussion result in local cache.
 *
 * @param {string} identifier - MUDP discussion identifier.
 * @param {string} instance - Mastodon instance.
 * @param {Object} data - Discussion data to cache.
 */
export function setCachedDiscussion(identifier, instance = '', data) {
  const key = getDiscussionCacheKey(identifier, instance);
  discussionCache.set(key, {
    timestamp: Date.now(),
    data
  });
}

/**
 * Clears the discussion cache.
 */
export function clearDiscussionCache() {
  discussionCache.clear();
}

/**
 * Normalizes an instance hostname.
 * e.g. "https://mastodon.social/" -> "mastodon.social"
 *
 * @param {string} input - Instance string or URL.
 * @returns {string} Hostname (e.g. "mastodon.social" or "" if empty).
 */
export function normalizeInstance(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  let trimmed = input.trim();
  // Strip leading @ or user handles like @user@instance
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@').filter(Boolean);
    if (parts.length > 0) {
      trimmed = parts[parts.length - 1];
    }
  }
  trimmed = trimmed.replace(/^https?:\/\//i, '');
  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed.toLowerCase();
}

/**
 * Fetches discussions for a given canonical URL or discussion identifier from a Mastodon instance.
 * Implements client-side caching per RFC-MUDP-0001 Section 11.
 *
 * @param {Object} options
 * @param {string} [options.url] - The canonical URL.
 * @param {string} [options.identifier] - The MUDP discussion identifier (e.g. "MUDP_9eba6b3c57ce169e19742b249a7f7542a620751a5c4b2f2c4990684f7e655f70").
 * @param {string} options.instance - The Mastodon instance host.
 * @param {number} [options.limit] - Max statuses to retrieve (default: 40).
 * @param {boolean} [options.bypassCache] - Whether to bypass local cache and force network request.
 * @param {number} [options.cacheTtlMs] - Cache TTL in milliseconds (default: 30 minutes, 15-60 min range).
 * @returns {Promise<{
 *   identifier: string,
 *   instance: string,
 *   posts: Array<Object>,
 *   rawCount: number,
 *   fromCache?: boolean
 * }>}
 */
export async function fetchDiscussion({
  url,
  identifier,
  instance = '',
  limit = 40,
  bypassCache = false,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS
}) {
  const host = normalizeInstance(instance);
  if (!host) {
    throw new Error('Mastodon instance not configured');
  }

  const discussionId = identifier || (url ? await generateDiscussionIdentifier(url) : null);

  if (!discussionId) {
    throw new Error('Either url or identifier must be provided');
  }

  const cleanTag = discussionId.replace(/^#/, '');

  if (!bypassCache) {
    const cached = getCachedDiscussion(cleanTag, host, cacheTtlMs);
    if (cached) {
      return {
        ...cached,
        fromCache: true
      };
    }
  }
  const headers = {
    'Accept': 'application/json',
    'X-MUDP': '1'
  };

  // 1. Primary method: Query public hashtag timeline endpoint
  // GET /api/v1/timelines/tag/:tag
  const timelineUrl = `https://${host}/api/v1/timelines/tag/${encodeURIComponent(cleanTag)}?limit=${limit}`;

  let rawStatuses = [];
  try {
    const res = await fetch(timelineUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        rawStatuses = data;
      }
    }
  } catch (err) {
    // If tag timeline fails (e.g. network/CORS), we can try search endpoint as fallback
  }

  // 2. Secondary fallback: Search endpoint
  // GET /api/v2/search?q=#MUDP_...&type=statuses
  if (rawStatuses.length === 0) {
    try {
      const searchUrl = `https://${host}/api/v2/search?q=${encodeURIComponent('#' + cleanTag)}&type=statuses&limit=${limit}`;
      const res = await fetch(searchUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.statuses)) {
          rawStatuses = data.statuses;
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  // Filter and enrich posts
  const verifiedPosts = [];
  for (const status of rawStatuses) {
    const verification = parseAndVerifyMudpPost(status, cleanTag);
    if (verification.isMudp) {
      verifiedPosts.push({
        id: status.id,
        url: status.url || `https://${host}/@${status.account?.acct}/${status.id}`,
        uri: status.uri,
        createdAt: status.created_at,
        content: status.content,
        spoilerText: status.spoiler_text || '',
        visibility: status.visibility,
        repliesCount: status.replies_count || 0,
        reblogsCount: status.reblogs_count || 0,
        favouritesCount: status.favourites_count || 0,
        account: {
          id: status.account?.id,
          username: status.account?.username,
          acct: status.account?.acct,
          displayName: status.account?.display_name || status.account?.username,
          avatar: status.account?.avatar,
          avatarStatic: status.account?.avatar_static,
          url: status.account?.url
        },
        verification,
        raw: status
      });
    }
  }

  const result = {
    identifier: cleanTag,
    instance: host,
    posts: verifiedPosts,
    rawCount: rawStatuses.length
  };

  setCachedDiscussion(cleanTag, host, result);

  return result;
}

/**
 * Creates a Mastodon Web Share / Web Intent URL.
 * Allows users on any Mastodon instance to open their web composer prefilled with MUDP post format.
 *
 * @param {Object} options
 * @param {string} options.url - The canonical URL.
 * @param {string} [options.text] - Comment text.
 * @param {string} options.instance - Mastodon instance.
 * @param {string} [options.identifier] - Precomputed discussion identifier.
 * @returns {Promise<string>} Web share URL.
 */
export async function createShareIntentUrl({
  url,
  text = '',
  instance = '',
  identifier
}) {
  const host = normalizeInstance(instance);
  if (!host) {
    throw new Error('Mastodon instance not configured');
  }
  const postBody = await formatMudpPost({ url, text, identifier });
  return `https://${host}/share?text=${encodeURIComponent(postBody)}`;
}
