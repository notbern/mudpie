# Mudpie for Chrome / Chromium

Manifest V3 browser extension for Google Chrome, Brave, Edge, and other Chromium-based browsers implementing the Mastodon URL Discussion Protocol (RFC-MUDP-0001).

## Features
- Discovers Mastodon discussions using `#MUDP_${hash12}` tags strictly on demand.
- Client-side throttling and caching (15–60 minute TTL per URL).
- Auto-fetching in the background is strictly prohibited (MUST NOT) to prevent load on Mastodon instances.
- Switch Mastodon instances on the fly or configure a default home instance.
- Compose posts with canonical URL and hashtags prefilled in Mastodon's Web Composer.
- Context menu integration ("Discuss on Mastodon (MUDP)").

## Loading in Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **"Developer mode"** in the top right.
3. Click **"Load unpacked"**.
4. Select this directory (`packages/extensions/chrome`).
