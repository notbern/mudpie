import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDiscussionHash,
  generateDiscussionIdentifier,
  getDiscussionHashtag,
  parseDiscussionIdentifier,
  PROTOCOL_HASHTAG,
  PROTOCOL_PREFIX,
  IDENTIFIER_LENGTH,
  sha256Hex,
  sha256Base64Url,
  bytesToBase64Url
} from '../packages/core/src/identifier.js';

test('bytesToBase64Url - encodes bytes into URL-safe unpadded Base64', () => {
  const sampleBytes = [0x3a, 0xf1, 0x82, 0xc9, 0x4e, 0x01, 0x7d, 0xbb, 0x1a];
  assert.strictEqual(bytesToBase64Url(sampleBytes), 'OvGCyU4Bfbsa');
});

test('SHA-256 computation produces valid 64-character hex and Base64URL', async () => {
  const hex = await sha256Hex('https://example.org/article');
  assert.strictEqual(hex.length, 64);
  assert.match(hex, /^[0-9a-f]{64}$/);

  const b64 = await sha256Base64Url('example.org/article', 9);
  assert.strictEqual(b64.length, 12);
  assert.strictEqual(b64, '2gcm_O6eB2sV');
});

test('Discussion identifier generation - 72-bit Base64URL with MUDP_ prefix', async () => {
  const hash = await generateDiscussionHash('https://example.org/article');
  assert.strictEqual(hash.length, 12);
  assert.strictEqual(hash, '2gcm_O6eB2sV');

  const identifier = await generateDiscussionIdentifier('https://example.org/article');
  assert.strictEqual(identifier, `${PROTOCOL_PREFIX}${hash}`);
  assert.strictEqual(identifier.startsWith('MUDP_'), true);
  assert.strictEqual(identifier.length, 17); // 'MUDP_' (5) + 12 = 17
  assert.strictEqual(IDENTIFIER_LENGTH, 12);
});

test('Discussion identifier normalization and HTTP/HTTPS equivalence', async () => {
  // URLs that normalize to the same canonical URL (including HTTP vs HTTPS) produce the exact same identifier
  const id1 = await generateDiscussionIdentifier('HTTPS://EXAMPLE.ORG/article/');
  const id2 = await generateDiscussionIdentifier('http://example.org/article#comments');
  const id3 = await generateDiscussionIdentifier('https://example.org/article?utm_source=mastodon');
  const id4 = await generateDiscussionIdentifier('example.org/article');

  assert.strictEqual(id1, id2);
  assert.strictEqual(id2, id3);
  assert.strictEqual(id3, id4);
  assert.strictEqual(id1, 'MUDP_2gcm_O6eB2sV');
});

test('Hashtag formatting', async () => {
  const hash = '2gcm_O6eB2sV';
  assert.strictEqual(PROTOCOL_HASHTAG, '#MUDP');
  assert.strictEqual(getDiscussionHashtag(`MUDP_${hash}`), `#MUDP_${hash}`);
  assert.strictEqual(getDiscussionHashtag(`#MUDP_${hash}`), `#MUDP_${hash}`);
});

test('parseDiscussionIdentifier', () => {
  const hash = '2gcm_O6eB2sV';
  assert.strictEqual(parseDiscussionIdentifier(`MUDP_${hash}`), hash);
  assert.strictEqual(parseDiscussionIdentifier(`#MUDP_${hash}`), hash);
  assert.strictEqual(parseDiscussionIdentifier(`mudp_${hash}`), hash);
  assert.strictEqual(parseDiscussionIdentifier('invalid_identifier'), null);
  assert.strictEqual(parseDiscussionIdentifier('MUDP_123'), null); // too short
  assert.strictEqual(parseDiscussionIdentifier('MUDP_9eba6b3c57ce169e19742b249a7f7542a620751a5c4b2f2c4990684f7e655f70'), null); // old 64-hex format is invalid
  assert.strictEqual(parseDiscussionIdentifier(''), null);
  assert.strictEqual(parseDiscussionIdentifier(null), null);
});
