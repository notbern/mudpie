/**
 * Mastodon URL Discussion Protocol (MUDP) - Identifier Module
 * Implements RFC-MUDP-0001 Section 6 (Discussion Identifier Generation) & Section 7 (Hashtag Namespace)
 */

import { normalizeUrl } from './url.js';

/**
 * Protocol constants
 */
export const PROTOCOL_HASHTAG = '#MUDP';
export const PROTOCOL_PREFIX = 'MUDP_';
export const IDENTIFIER_LENGTH = 12; // 72-bit Base64URL string (12 chars)
export const IDENTIFIER_REGEX = /^#?MUDP_([A-Za-z0-9_-]{12})$/i;

const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Encodes a byte array or Uint8Array into URL-safe Base64 without padding (RFC 4648 §5).
 *
 * @param {Uint8Array|number[]} bytes - Raw bytes to encode.
 * @returns {string} URL-safe unpadded Base64 string.
 */
export function bytesToBase64Url(bytes) {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    result += BASE64URL_CHARS[(b0 >> 2) & 0x3f];
    result += BASE64URL_CHARS[((b0 & 0x03) << 4) | ((b1 >> 4) & 0x0f)];
    if (i + 1 < len) {
      result += BASE64URL_CHARS[((b1 & 0x0f) << 2) | ((b2 >> 6) & 0x03)];
    }
    if (i + 2 < len) {
      result += BASE64URL_CHARS[b2 & 0x3f];
    }
  }
  return result;
}

/**
 * Computes SHA-256 digest of a string and returns the first N bytes encoded in Base64URL.
 * RFC Section 6: Extract first 9 bytes (72 bits) and encode using URL-safe Base64 without padding.
 *
 * @param {string} input - The string to hash.
 * @param {number} [byteLength=9] - Number of bytes to extract (default: 9 bytes = 72 bits).
 * @returns {Promise<string>} Base64URL-encoded digest.
 */
export async function sha256Base64Url(input, byteLength = 9) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer).subarray(0, byteLength);
    return bytesToBase64Url(hashArray);
  }

  // Fallback for Node.js environments if crypto.subtle is not available
  try {
    const nodeCrypto = await import('node:crypto');
    const buf = nodeCrypto.createHash('sha256').update(input, 'utf8').digest();
    return bytesToBase64Url(buf.subarray(0, byteLength));
  } catch {
    throw new Error('SHA-256 implementation not available in current environment');
  }
}

/**
 * Synchronous SHA-256 Base64URL for Node.js runtime.
 *
 * @param {string} input - The string to hash.
 * @param {number} [byteLength=9] - Number of bytes to extract.
 * @returns {string} Base64URL string.
 */
export function sha256Base64UrlSync(input, byteLength = 9) {
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const nodeCrypto = (typeof require !== 'undefined') ? require('crypto') : null;
      if (nodeCrypto) {
        const buf = nodeCrypto.createHash('sha256').update(input, 'utf8').digest();
        return bytesToBase64Url(buf.subarray(0, byteLength));
      }
    }
  } catch {}
  throw new Error('Synchronous hashing only supported in Node.js runtime. Use async generateDiscussionIdentifier()');
}

/**
 * Computes full SHA-256 digest of a string and returns it as a lowercase hex string.
 *
 * @param {string} input - The string to hash.
 * @returns {Promise<string>} Full SHA-256 hex digest in lowercase.
 */
export async function sha256Hex(input) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }

  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha256').update(input, 'utf8').digest('hex').toLowerCase();
  } catch {
    throw new Error('SHA-256 implementation not available in current environment');
  }
}

/**
 * Generates the 12-character Base64URL discussion hash from a canonical URL.
 * RFC Section 6: "Extract the first 9 bytes (72 bits) of the digest. Encode using URL-safe Base64 without padding."
 *
 * @param {string} url - The URL (will be normalized).
 * @returns {Promise<string>} The 12-character Base64URL hash (e.g. "2gcm_O6eB2sV").
 */
export async function generateDiscussionHash(url) {
  const normalized = normalizeUrl(url);
  const hash = await sha256Base64Url(normalized, 9);
  return hash;
}

/**
 * Generates the full Discussion Identifier per RFC Section 6.
 * "Discussion Identifier: MUDP_2gcm_O6eB2sV"
 *
 * @param {string} url - The URL (will be normalized).
 * @returns {Promise<string>} The discussion identifier (e.g. "MUDP_2gcm_O6eB2sV").
 */
export async function generateDiscussionIdentifier(url) {
  const hash = await generateDiscussionHash(url);
  return `${PROTOCOL_PREFIX}${hash}`;
}

/**
 * Returns the discussion hashtag for a given URL or identifier.
 * RFC Section 7: "#MUDP_2gcm_O6eB2sV"
 *
 * @param {string} identifier - Discussion identifier (e.g. "MUDP_2gcm_O6eB2sV") or hashtag.
 * @returns {string} The discussion hashtag (e.g. "#MUDP_2gcm_O6eB2sV").
 */
export function getDiscussionHashtag(identifier) {
  if (identifier.startsWith('#')) {
    return identifier;
  }
  return `#${identifier}`;
}

/**
 * Validates and extracts the 12-character Base64URL hash from a MUDP identifier or hashtag.
 *
 * @param {string} input - e.g. "MUDP_2gcm_O6eB2sV" or "#MUDP_2gcm_O6eB2sV".
 * @returns {string|null} The 12-char Base64URL hash or null if invalid.
 */
export function parseDiscussionIdentifier(input) {
  if (!input || typeof input !== 'string') return null;
  const match = input.trim().match(IDENTIFIER_REGEX);
  return match ? match[1] : null;
}
