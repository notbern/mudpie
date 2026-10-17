# Mudpie: Mastodon URL Discussion Protocol (MUDP)

Mudpie is an open-source browser extension and toolkit implementing **RFC-MUDP-0001 (Mastodon URL Discussion Protocol)**.

MUDP associates Mastodon posts with arbitrary web resources using deterministic URL hashing and Mastodon's native hashtag indexing. This allows users to discover and participate in decentralized discussions for any webpage without requiring website operator opt-in, ActivityPub server changes, or centralized databases.

This implementation is generated using LLMs based on [RFC-MUDP-0001](RFC.md).

---

## Directory Structure

The project is structured as a modular monorepo so that extensions for other browsers (Firefox, Chrome, Edge, Safari), bookmarklets, and external clients share the same protocol core.

```
mudpie/
├── packages/
│   ├── core/                    # Shared MUDP protocol implementation
│   │   ├── src/
│   │   │   ├── url.js           # RFC Section 5: URL normalization & canonical link extractor
│   │   │   ├── identifier.js    # RFC Section 6 & 7: SHA-256 identifier & hashtag generation
│   │   │   ├── post.js          # RFC Section 8 & 13: MUDP post builder & validator
│   │   │   ├── mastodon.js      # RFC Section 9 & 10: Mastodon API client & share intent URLs
│   │   │   ├── storage.js       # Cross-platform preferences & settings
│   │   │   └── index.js         # Public core module entry point
│   │   └── README.md
│   │
│   ├── extensions/              # Browser extensions
│   │   ├── shared/              # Shared UI components and assets
│   │   │   ├── popup/           # Extension popup (discussion viewer, composer, instance switcher)
│   │   │   ├── options/         # Extension settings page
│   │   │   ├── content/         # Content script for canonical URL extraction
│   │   │   └── icons/           # App icons (SVG + 16, 32, 48, 96, 128 PNGs)
│   │   ├── firefox/             # Firefox WebExtension
│   │   │   ├── manifest.json    # Firefox WebExtension manifest (Gecko ID, MV2/MV3)
│   │   │   ├── background.js    # Background script (tabs, badge count, context menus)
│   │   │   └── README.md
│   │   └── chrome/              # Chrome / Chromium extension
│   │       ├── manifest.json    # Manifest V3 configuration
│   │       ├── background.js    # Service worker
│   │       └── README.md
│   │
│   └── bookmarklets/            # Standalone browser bookmarklets
│       ├── mudpie-view.js       # View discussions bookmarklet
│       ├── mudpie-share.js      # Share / discuss page bookmarklet
│       └── README.md            # Drag-and-drop bookmarklet installation
│
├── tests/                       # Unit & integration test suite (node:test)
│   ├── url.test.js              # URL normalization and canonical tag tests
│   ├── identifier.test.js       # SHA-256 and identifier format tests
│   ├── post.test.js             # Post formatting and verification tests
│   └── mastodon.test.js         # API discovery and share URL tests
│
├── scripts/
│   ├── build.js                 # Packaging & distribution build script
│   └── generate-icons.js        # Raster icon generator
│
├── dist/                        # Packaged release archives (.zip / .xpi)
├── RFC.md                       # RFC-MUDP-0001 Specification
└── package.json
```

---

## Firefox Extension

### Features
- **Discussion Discovery:** Fetches and displays Mastodon discussions for the current webpage using `#MUDP_${hash12}` tags strictly on demand when user opens popup or triggers bookmarklet.
- **Client-Side Throttling & Caching (RFC Section 11):** Implements local caching with 15–60 minute TTLs per URL. Auto-fetching in the background is strictly prohibited (MUST NOT) to eliminate background API load on Mastodon servers.
- **No Default Servers & Custom Instances (RFC Section 10):** Users manually configure and enter their home Mastodon instance with no hardcoded default servers.
- **Transparent Server Control & Header (RFC Section 11):** Clients send `X-MUDP: 1` header in every request so server administrators can easily identify, rate-limit, or block MUDP extension traffic.
- **Composer & Web Intent:** Compose replies or start new discussions with canonical URLs and `#MUDP` hashtags prefilled via Mastodon's Web Composer.
- **Safe HTML Sanitization & Content Warning (CW) support:** Unsafe HTML tags and scripts are safely filtered, and spoiler text / CWs are expandable.
- **Context Menus:** Right-click any webpage or link to "Discuss on Mastodon (MUDP)" or copy the MUDP discussion tag.

### Installing in Firefox (Temporary Add-on for Development)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select `packages/extensions/firefox/manifest.json` (or `dist/mudpie-firefox.zip` / `dist/mudpie-firefox.xpi`).
4. The Mudpie icon will appear in your Firefox toolbar.

---

## Running Tests & Building (Podman Only)

The build and test workflow is containerized using Podman for full reproducibility and isolation.

### Makefile Targets

```bash
# Build container image and package all extension zip/xpi files into dist/
make build

# Run test suite inside Podman container
make test

# Build Podman container image only
make image

# Clean build artifacts
make clean

# Show help
make help
```

### Direct Podman Commands
```bash
# Build image
podman build -t mudpie:latest .

# Run build to output packages into dist/
podman run --rm -v $(pwd)/dist:/app/dist:Z mudpie:latest node scripts/build.js

# Run test suite
podman run --rm mudpie:latest node --test tests/*.test.js
```

Generates ready-to-distribute packages in `dist/`:
- `dist/mudpie-firefox.zip` and `dist/mudpie-firefox.xpi`
- `dist/mudpie-chrome.zip`
- `packages/bookmarklets/README.md` (bookmarklet JS URLs)

---

## Protocol Overview (RFC-MUDP-0001)

1. **URL Normalization (Section 5):**
   - Protocol scheme (`http://`, `https://`, etc.) and leading `//` stripped.
   - Hostname converted to lowercase and ASCII Punycode (RFC 3492).
   - Default ports (`:80`, `:443`) removed.
   - Fragments (`#...`) removed.
   - Trailing slashes removed (except for root path `/`).
   - Known tracking parameters (`utm_*`, `fbclid`, `gclid`, etc.) stripped.
   - Remaining query parameters sorted lexicographically by UTF-8 byte order.
   - Document `<link rel="canonical" href="...">` resolved against base URI with same-origin guardrails.

2. **Discussion Identifier (Section 6 & 7):**
   - Normalized URL string (without protocol scheme) is hashed with SHA-256.
   - The first 9 bytes (72 bits) are extracted and encoded using URL-safe Base64 without padding (12 characters): `MUDP_${base64url}` (e.g. `MUDP_2gcm_O6eB2sV`).
   - Hashtag format: `#MUDP` and `#MUDP_2gcm_O6eB2sV`.

3. **Post Format (Section 8):**
   ```
   Interesting article.

   https://example.org/article

   #MUDP
   #MUDP_2gcm_O6eB2sV
   ```

4. **Discovery (Section 9 & 10):**
   - Queries `GET /api/v1/timelines/tag/MUDP_${base64url}` and `GET /api/v2/search?q=%23MUDP_${base64url}&type=statuses`.
   - Local-instance-only operation without central servers.

5. **Client-Side Throttling, Caching & Auto-Fetch Prohibition (Section 11):**
   - Clients MUST NOT auto-fetch or poll discussions in the background during web browsing. Queries are initiated strictly on explicit user action. Extensions implement local caching (15–60 minute TTLs per URL) to minimize server load.

---

## Contributing & Development Workflow

Mudpie enforces a strict Pull Request workflow with automated containerized testing. Direct pushes to `main` are disabled.

1. Create a feature or fix branch (`feature/*`, `fix/*`).
2. Verify all tests and builds succeed locally (`make test` and `make build`).
3. Submit a Pull Request targeting `main`.
4. Ensure all GitHub Actions status checks (`build-and-test`) pass before merge.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines and branch governance details.

---

## License
GNU General Public License v3.0 (GPL-3.0-or-later). See `LICENSE` and RFC-MUDP-0001 for protocol specification.
