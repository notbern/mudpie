import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMudpPost, parseAndVerifyMudpPost, stripHtml } from '../packages/core/src/post.js';
import { generateDiscussionIdentifier } from '../packages/core/src/identifier.js';

test('formatMudpPost - formats RFC Section 8 compliant post with unnormalized URL', async () => {
  const rawUrl = 'https://example.org/article?utm_source=mastodon';
  const text = 'Interesting article.';
  const identifier = await generateDiscussionIdentifier(rawUrl);

  const post = await formatMudpPost({ url: rawUrl, text });
  
  // Post must contain:
  // 1. Unnormalized URL
  // 2. #MUDP
  // 3. Discussion hashtag #MUDP_...
  assert.match(post, /Interesting article\./);
  assert.match(post, /https:\/\/example\.org\/article\?utm_source=mastodon/);
  assert.match(post, /#MUDP\b/);
  assert.match(post, new RegExp(`#${identifier}\\b`));
});

test('formatMudpPost - formats post without extra comment text preserving unnormalized URL', async () => {
  const url = 'https://example.org/article';
  const post = await formatMudpPost({ url });
  
  assert.match(post, /^https:\/\/example\.org\/article\n\n#MUDP\n#MUDP_[A-Za-z0-9_-]{12}$/);
});

test('stripHtml - removes html tags and converts line breaks', () => {
  const html = '<p>Hello world<br>This is a test.</p><p>&amp; enjoy</p>';
  const stripped = stripHtml(html);
  assert.strictEqual(stripped, 'Hello world\nThis is a test.\n\n& enjoy');
});

test('parseAndVerifyMudpPost - verifies valid MUDP status', async () => {
  const url = 'https://example.org/article';
  const identifier = await generateDiscussionIdentifier(url);

  const mockStatus = {
    id: '123456',
    content: `<p>Great read!<br><br><a href="${url}">${url}</a><br><br><a href="/tags/MUDP">#MUDP</a> <a href="/tags/${identifier}">#${identifier}</a></p>`,
    tags: [
      { name: 'MUDP' },
      { name: identifier }
    ]
  };

  const verification = parseAndVerifyMudpPost(mockStatus, identifier);
  assert.strictEqual(verification.isMudp, true);
  assert.strictEqual(verification.discussionIdentifier, identifier);
  assert.strictEqual(verification.url, url);
  assert.strictEqual(verification.userComment, 'Great read!');
});

test('parseAndVerifyMudpPost - verifies status containing normalized / schemeless URL', async () => {
  const rawUrl = 'https://example.org/article';
  const identifier = await generateDiscussionIdentifier(rawUrl);

  const mockStatus = {
    id: '654321',
    content: `<p>Interesting thoughts on <a href="https://example.org/article">example.org/article</a> #MUDP #${identifier}</p>`,
    tags: [{ name: 'MUDP' }, { name: identifier }]
  };

  const verification = parseAndVerifyMudpPost(mockStatus, identifier);
  assert.strictEqual(verification.isMudp, true);
  assert.strictEqual(verification.discussionIdentifier, identifier);
  assert.strictEqual(verification.url, 'example.org/article');
  assert.strictEqual(verification.userComment, 'Interesting thoughts on');
});

test('parseAndVerifyMudpPost - rejects non-MUDP status', () => {
  const mockStatus = {
    id: '999',
    content: '<p>Just a random toot with no hashtags.</p>',
    tags: []
  };

  const verification = parseAndVerifyMudpPost(mockStatus);
  assert.strictEqual(verification.isMudp, false);
});
