import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeInstance,
  createShareIntentUrl,
  fetchDiscussion,
  getCachedDiscussion,
  setCachedDiscussion,
  clearDiscussionCache
} from '../packages/core/src/mastodon.js';
import { generateDiscussionIdentifier } from '../packages/core/src/identifier.js';

test('normalizeInstance - handles various URL formats and handles', () => {
  assert.strictEqual(normalizeInstance('mastodon.social'), 'mastodon.social');
  assert.strictEqual(normalizeInstance('https://mastodon.social/'), 'mastodon.social');
  assert.strictEqual(normalizeInstance('http://fosstodon.org'), 'fosstodon.org');
  assert.strictEqual(normalizeInstance('@user@hachyderm.io'), 'hachyderm.io');
  assert.strictEqual(normalizeInstance(''), '');
  assert.strictEqual(normalizeInstance(null), '');
});

test('createShareIntentUrl - generates valid web share intent link', async () => {
  const url = 'https://example.org/article';
  const text = 'Great post!';
  const shareUrl = await createShareIntentUrl({
    instance: 'mastodon.social',
    url,
    text
  });

  const parsed = new URL(shareUrl);
  assert.strictEqual(parsed.hostname, 'mastodon.social');
  assert.strictEqual(parsed.pathname, '/share');
  
  const queryText = parsed.searchParams.get('text');
  assert.match(queryText, /Great post!/);
  assert.match(queryText, /https:\/\/example\.org\/article/);
  assert.match(queryText, /#MUDP/);
  assert.match(queryText, /#MUDP_[A-Za-z0-9_-]{12}/);

  await assert.rejects(
    async () => createShareIntentUrl({ url, text, instance: '' }),
    /Mastodon instance not configured/
  );
});

test('fetchDiscussion - parses and returns posts with mock fetch and sends X-MUDP header', async () => {
  const url = 'https://example.org/article';
  const identifier = await generateDiscussionIdentifier(url);

  let capturedHeaders = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (reqUrl, options) => {
    capturedHeaders = options?.headers;
    return {
      ok: true,
      async json() {
        return [
          {
            id: '1001',
            created_at: '2026-06-04T12:00:00Z',
            content: `<p>My thoughts on this article:<br><br>${url}<br><br>#MUDP #${identifier}</p>`,
            visibility: 'unlisted',
            tags: [{ name: 'mudp' }, { name: identifier }],
            account: {
              id: '42',
              username: 'alice',
              acct: 'alice@example.social',
              display_name: 'Alice',
              avatar: 'https://example.social/avatars/alice.png'
            }
          }
        ];
      }
    };
  };

  try {
    const result = await fetchDiscussion({
      url,
      instance: 'mastodon.social',
      bypassCache: true
    });

    assert.strictEqual(result.identifier, identifier);
    assert.strictEqual(result.posts.length, 1);
    assert.strictEqual(result.posts[0].account.username, 'alice');
    assert.strictEqual(result.posts[0].verification.isMudp, true);
    assert.strictEqual(capturedHeaders?.['X-MUDP'], '1');

    await assert.rejects(
      async () => fetchDiscussion({ url, instance: '' }),
      /Mastodon instance not configured/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchDiscussion - caches results according to TTL and supports cache bypass', async () => {
  clearDiscussionCache();
  const url = 'https://example.org/cache-test';
  const identifier = await generateDiscussionIdentifier(url);

  let fetchCallCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCallCount++;
    return {
      ok: true,
      async json() {
        return [
          {
            id: '2001',
            created_at: '2026-06-04T12:00:00Z',
            content: `<p>Post ${fetchCallCount}<br><br>${url}<br><br>#MUDP #${identifier}</p>`,
            visibility: 'public',
            tags: [{ name: 'mudp' }, { name: identifier }],
            account: { id: '1', username: 'tester', acct: 'tester' }
          }
        ];
      }
    };
  };

  try {
    // 1. First fetch - cache miss -> network call
    const firstResult = await fetchDiscussion({
      url,
      instance: 'mastodon.social',
      cacheTtlMs: 30 * 60 * 1000
    });
    assert.strictEqual(fetchCallCount, 1);
    assert.strictEqual(firstResult.fromCache, undefined);

    // 2. Second fetch within TTL - cache hit -> no network call
    const cachedResult = await fetchDiscussion({
      url,
      instance: 'mastodon.social',
      cacheTtlMs: 30 * 60 * 1000
    });
    assert.strictEqual(fetchCallCount, 1);
    assert.strictEqual(cachedResult.fromCache, true);
    assert.strictEqual(cachedResult.identifier, identifier);

    // 3. Third fetch with bypassCache=true - forces network call
    const bypassResult = await fetchDiscussion({
      url,
      instance: 'mastodon.social',
      bypassCache: true
    });
    assert.strictEqual(fetchCallCount, 2);
    assert.strictEqual(bypassResult.fromCache, undefined);

    // 4. Test cache expiry with short TTL
    setCachedDiscussion(identifier, 'mastodon.social', { identifier, instance: 'mastodon.social', posts: [] });
    assert.ok(getCachedDiscussion(identifier, 'mastodon.social', 10000));
    assert.strictEqual(getCachedDiscussion(identifier, 'mastodon.social', -1), null);

    // 5. Test clearDiscussionCache
    clearDiscussionCache();
    assert.strictEqual(getCachedDiscussion(identifier, 'mastodon.social'), null);
  } finally {
    globalThis.fetch = originalFetch;
    clearDiscussionCache();
  }
});
