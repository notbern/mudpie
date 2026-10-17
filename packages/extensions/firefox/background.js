/**
 * Mastodon URL Discussion Protocol (MUDP) - Firefox Background Script
 * Handles context menus and navigation.
 * Note: Auto-fetching in the background is strictly prohibited (MUST NOT) to minimize server load.
 */

import { generateDiscussionIdentifier } from './core/src/identifier.js';
import { normalizeUrl } from './core/src/url.js';
import { createShareIntentUrl } from './core/src/mastodon.js';
import { getSettings } from './core/src/storage.js';

const browserApi = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined') ? chrome : null;

// Create Context Menus
if (browserApi && browserApi.contextMenus) {
  browserApi.runtime.onInstalled.addListener(() => {
    browserApi.contextMenus.create({
      id: 'mudpie_share_page',
      title: 'Discuss on Mastodon (MUDP)',
      contexts: ['page', 'link']
    });

    browserApi.contextMenus.create({
      id: 'mudpie_copy_tag',
      title: 'Copy MUDP Discussion Tag',
      contexts: ['page', 'link']
    });
  });

  browserApi.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
      if (!targetUrl) return;

      const canonical = normalizeUrl(targetUrl);
      const identifier = await generateDiscussionIdentifier(canonical);
      const settings = await getSettings();

      if (info.menuItemId === 'mudpie_share_page') {
        if (!settings.instance) return;
        const shareUrl = await createShareIntentUrl({
          url: targetUrl,
          instance: settings.instance,
          identifier
        });
        if (browserApi.tabs && browserApi.tabs.create) {
          browserApi.tabs.create({ url: shareUrl });
        }
      } else if (info.menuItemId === 'mudpie_copy_tag') {
        // Send message to content script or active tab to copy
        const hashtag = `#${identifier}`;
        if (tab && tab.id && browserApi.tabs && browserApi.tabs.executeScript) {
          browserApi.tabs.executeScript(tab.id, {
            code: `navigator.clipboard.writeText(${JSON.stringify(hashtag)})`
          }).catch(() => {});
        }
      }
    } catch {
      // Gracefully ignore any context menu or tab handling errors
    }
  });
}
