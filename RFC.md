# RFC-MUDP-0001

# Mastodon URL Discussion Protocol (MUDP)

**Version:** 0.1.1 Draft
**Status:** Experimental
**Pronunciation:** "Mudpie"
**Date:** 2026-06-04

---

# Abstract

The Mastodon URL Discussion Protocol (MUDP) defines a convention for associating Mastodon posts with arbitrary web resources.

MUDP enables browser extensions and other clients to discover discussions about web pages using only existing Mastodon functionality.

The protocol requires:

- No Mastodon server modifications
- No ActivityPub extensions
- No central indexing service
- No custom account system

MUDP uses Mastodon's existing hashtag infrastructure as a distributed discussion index.

A discussion about a URL is identified by a deterministic hashtag derived from the canonical URL.

---

# 1. Introduction

Many websites have removed comment sections due to moderation burden, spam, abuse, and maintenance costs.

At the same time, Mastodon already provides:

- User identities
- Moderation
- Federation
- Search
- Hashtag indexing
- Existing social graphs

MUDP leverages these capabilities to create URL-scoped discussions without requiring participation from the website operator.

The protocol is intentionally simple and designed to work on existing Mastodon deployments.

---

# 2. Requirements Language

The key words:

- MUST
- MUST NOT
- REQUIRED
- SHALL
- SHALL NOT
- SHOULD
- SHOULD NOT
- MAY

are to be interpreted as described in RFC 2119.

---

# 3. Goals

MUDP SHALL:

- Work on existing Mastodon installations.
- Require no server modifications.
- Permit implementation as a browser extension.
- Use Mastodon's hashtag index for discovery.
- Permit local-instance-only operation.
- Remain understandable to ordinary Mastodon users.
- Operate without central infrastructure.

MUDP SHALL NOT:

- Require global Fediverse discovery.
- Require custom ActivityPub vocabularies.
- Require dedicated bot accounts.
- Require centralized comment databases.
- Require websites to opt in.

---

# 4. Terminology

## Resource URL

The URL being discussed.

Example:

[https://example.org/article](https://example.org/article)

## Canonical URL

The normalized URL used as the protocol input.

## Discussion Identifier

The hash-derived identifier associated with a canonical URL.

Example:

MUDP_2gcm_O6eB2sV

## MUDP Post

A Mastodon post conforming to this specification.

## Client

Software implementing MUDP.

Examples:

- Browser extensions
- Mobile applications
- Web applications

---

# 5. URL Normalization

Before generating an identifier, clients MUST normalize the URL.

The following transformations SHALL be applied in order:

## Protocol / Scheme

Clients MUST strip the protocol scheme (`http://`, `https://`, or other schemes) and any leading double slashes (`//`).

Example:

https://example.org/article

becomes:

example.org/article

## Hostname & Domain Name Encoding

Convert hostname to lowercase. Clients MUST convert hostnames to ASCII Punycode (RFC 3492) prior to hashing.

Example:

EXAMPLE.ORG/article

becomes:

example.org/article

Example (Internationalized Domain Name):

https://münchen.de/article

becomes:

xn--mnchen-3ya.de/article

## Port

Remove standard default ports (`:80` for HTTP, `:443` for HTTPS).

## Fragment

Remove URL fragments (including the `#` character).

Example:

example.org/article#comments

becomes:

example.org/article

## Trailing Slash

Remove trailing slashes except when the path is root.

Example:

example.org/article/

becomes:

example.org/article

## Tracking Parameters & Query Parameter Sorting

Clients SHOULD remove known tracking query parameters.

Examples:

utm_source
utm_medium
utm_campaign
fbclid
gclid

Clients MUST sort remaining query parameters lexicographically by UTF-8 byte order (e.g. `a=1&b=2`).

Example:

example.org/search?sort=desc&page=2

becomes:

example.org/search?page=2&sort=desc

## Canonical Tag Resolution & Guardrails

If the document contains:

```html
<link rel="canonical" href="...">
```

clients MUST resolve any relative URL reference against the document's base URI before applying normalization steps.

To prevent cross-site hijacking and misdirection, clients MUST verify that the canonical URL matches the same hostname / origin as the document, and MUST fall back to the document's current URL if the canonical URL points to a different origin.

---

# 6. Discussion Identifier Generation

The normalized URL string (without protocol scheme) SHALL be hashed using SHA-256.

Example Input:
"example.org/article"

1. Compute SHA-256 digest of the normalized UTF-8 string.
2. Extract the first 9 bytes (72 bits) of the digest.
3. Encode the 9 bytes using URL-safe Base64 without padding (RFC 4648 §5).

Example Hash Calculation:
SHA256("example.org/article")
-> Raw First 9 Bytes: [0xda, 0x07, 0x26, 0xfc, 0xee, 0x9e, 0x07, 0x6b, 0x15]
-> Base64URL Output:  2gcm_O6eB2sV

Discussion Identifier:
MUDP_2gcm_O6eB2sV

Discussion Hashtag:
#MUDP_2gcm_O6eB2sV

---

# 7. Hashtag Namespace

MUDP reserves the hashtag namespace:

#MUDP*

The namespace consists of:

## Protocol Hashtag

Human-readable protocol identifier:

#MUDP

## Discussion Hashtag

URL-scoped discussion identifier:

#MUDP_

Example:

#MUDP_2gcm_O6eB2sV

## Future Extensions

Future versions MAY define additional tags:

#MUDP_VIDEO
#MUDP_ARTICLE
#MUDP_AUDIO
#MUDP_PAYWALL
#MUDP_DE
#MUDP_EN

Clients MUST ignore unknown MUDP-prefixed hashtags.

---

# 8. Post Format

A MUDP-compliant post MUST contain:

1. The unnormalized URL. Links in the post MUST be the unnormalized URL.
2. The hashtag #MUDP.
3. The discussion hashtag.

Links in the post MUST be the unnormalized URL (including the scheme/protocol) so that standard Mastodon clients and web browsers can render functional, clickable hyperlinks and users can navigate directly to the original resource without ambiguity.

Example:

Interesting article.

https://example.org/article

#MUDP
#MUDP_2gcm_O6eB2sV

Additional content MAY be included.

The order of hashtags is implementation-defined.

---

# 9. Discovery

To discover comments associated with a URL:

1. Normalize URL.
2. Generate SHA-256 digest and 72-bit Base64URL discussion hash.
3. Construct discussion hashtag.
4. Query Mastodon hashtag search.

Example:

URL:

https://example.org/article

Discussion hashtag:

#MUDP_2gcm_O6eB2sV

All matching posts are members of the discussion.

---

# 10. Local Discovery

MUDP explicitly supports local-instance-only operation.

Clients MAY restrict discovery to:

- Local posts
- Local search indexes
- Known federated content
- Followed accounts

Implementations are NOT required to discover comments across the entire Fediverse.

A client operating solely against a user's home Mastodon instance is fully compliant.

Clients MUST NOT hardcode or bundle default Mastodon servers. Users MUST manually configure and enter their own preferred Mastodon instance.

---

# 11. Browser Extension Behavior

## Comment Creation

When a user creates a comment:

1. Determine canonical URL.
2. Normalize URL.
3. Generate discussion identifier.
4. Create Mastodon post containing the unnormalized URL, #MUDP, and discussion hashtag.
5. Publish post (e.g. via Mastodon web share or client).

Example:

I disagree with this conclusion.

https://example.org/article

#MUDP
#MUDP_2gcm_O6eB2sV

## Comment Retrieval

When discussion discovery is explicitly initiated by a user (e.g. by opening the extension popup, clicking a "View Discussions" button, or activating a bookmarklet):

1. Determine canonical URL.
2. Normalize URL.
3. Generate discussion identifier.
4. Search Mastodon for the discussion hashtag.
5. Display matching posts.

## Client-Side Throttling, Caching & Auto-Fetch Prohibition

Clients and browser extensions MUST NOT perform automatic background fetching, background polling, or prefetching of discussions across visited web pages. Automatic background fetching causes massive, unsustainable traffic spikes and unnecessary load on Mastodon server infrastructure. All discussion queries MUST be initiated strictly upon explicit user request.

When queries are explicitly initiated by the user, extensions MUST implement local caching (e.g., 15–60 minute TTLs per URL) to prevent redundant network requests and further protect Mastodon instances from API flooding.

## Request Identification & Server Control

Clients MUST include the custom HTTP header:

```http
X-MUDP: 1
```

in all HTTP requests sent to Mastodon servers (including timeline lookups and search API queries).

This header enables server administrators to easily identify, monitor, rate-limit, or block MUDP extension traffic at the reverse proxy or firewall level without affecting standard user interaction or regular web browsing.

---

# 12. Visibility

MUDP posts MUST be Public.

Unlisted, followers-only, or direct posts are not indexed or discoverable in public hashtag searches and timelines, defeating URL discussion discovery.

---

# 13. Collision Handling

MUDP uses the first 9 bytes (72 bits) of the SHA-256 digest encoded in 12 URL-safe Base64 characters without padding (RFC 4648 §5).

This provides 72 bits of collision safety.

Accidental collisions are exceedingly improbable in practical usage across public web resources.

The URL itself remains authoritative.

---

# 14. Moderation

MUDP inherits Mastodon moderation.

Implementations SHOULD respect:

- User blocks
- User mutes
- Domain blocks
- Server moderation policies
- Content warnings

Server administrators MAY block or throttle MUDP traffic by filtering incoming requests containing the `X-MUDP` HTTP header.

No additional moderation layer is defined.

---

# 15. Privacy Considerations

Users SHOULD assume:

- URLs are public.
- Comments are public.
- Discussion identifiers are publicly visible.

MUDP intentionally exposes the discussed resource.

Implementations MUST NOT transmit browsing activity without explicit user consent.

Automatic background discovery and auto-fetching MUST NOT be implemented or performed. All comment discovery and API queries MUST occur only upon explicit user initiation.

---

# 16. Security Considerations

Clients MUST treat all discovered content as untrusted.

Implementations SHOULD:

- Sanitize HTML
- Validate URLs
- Ignore malformed identifiers

The presence of a MUDP hashtag does not imply endorsement by the referenced website.

---

# 17. Rationale

MUDP intentionally uses hashtags because:

- Mastodon already indexes hashtags efficiently.
- Hashtag search is widely implemented.
- No server modifications are required.
- Discovery remains computationally inexpensive.

A URL hash is used rather than the URL itself because:

- Hashtags are indexed more efficiently than arbitrary text.
- 72-bit Base64URL encoding keeps tags compact (12 characters, 17 characters total with `#MUDP_` prefix).
- Different URL lengths produce a fixed-size identifier.
- Search performance is predictable.
- Protocol stripping ensures HTTP and HTTPS variants map deterministically to the exact same discussion index.
- Punycode domain name encoding (RFC 3492) ensures Unicode and ASCII internationalized domain variants map to the identical discussion tag.
- Lexicographical query parameter sorting guarantees deterministic hashing regardless of query parameter order in URLs.
- Canonical URL resolution against base URIs with same-origin guardrails unifies discussions across equivalent paths while preventing cross-domain hijacking.

The visible hashtag:

#MUDP

serves as:

- A protocol identifier
- A moderation target
- A filtering target
- A discovery mechanism for users

The discussion hashtag:

#MUDP_

serves as the machine-readable identifier.

---

# 18. Example

Resource URL:

https://www.spiegel.de/politik/example

Canonical URL:

www.spiegel.de/politik/example

SHA-256 (First 9 Bytes):

[0xc3, 0xbd, 0x01, 0x0d, 0x6c, 0xb2, 0x59, 0x8a, 0x7a]

Base64URL Output:

w70BDWyyWYp6

Discussion Identifier:

MUDP_w70BDWyyWYp6

Resulting Post:

This article misses several important aspects of the debate.

https://www.spiegel.de/politik/example

#MUDP
#MUDP_w70BDWyyWYp6

A MUDP-aware client associates the post with the article.

A standard Mastodon client displays an ordinary post.

---

# 19. Acknowledgements

The protocol name "MUDP" is pronounced "Mudpie".

The name reflects both the protocol acronym and the occasionally chaotic nature of online discussions.

