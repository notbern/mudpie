# Mudpie for Firefox

Firefox WebExtension implementing the Mastodon URL Discussion Protocol (RFC-MUDP-0001).

## Loading in Firefox

### Method 1: Temporary Add-on via about:debugging
1. Open Firefox.
2. Navigate to `about:debugging#/runtime/this-firefox`.
3. Click **"Load Temporary Add-on..."**.
4. Select `manifest.json` in this directory (or `dist/mudpie-firefox.zip` / `dist/mudpie-firefox.xpi`).

### Method 2: Direct .xpi Installation
Open the generated `dist/mudpie-firefox.xpi` file in Firefox.

## Features
- Discovers Mastodon discussions using `#MUDP_${hash12}` tags strictly on demand.
- Client-side throttling and caching (15–60 minute TTL per URL).
- Auto-fetching in the background is strictly prohibited (MUST NOT) to prevent load on Mastodon instances.
- Switch Mastodon instances on the fly or configure a default home instance.
- Compose posts with canonical URL and hashtags prefilled in Mastodon's Web Composer.
- Context menu integration ("Discuss on Mastodon (MUDP)").
