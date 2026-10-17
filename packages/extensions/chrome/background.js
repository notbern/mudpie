/**
 * Mastodon URL Discussion Protocol (MUDP) - Chrome MV3 Background Service Worker
 * Handles context menus and navigation.
 * Note: Auto-fetching in the background is strictly prohibited (MUST NOT) to minimize server load.
 */

import { generateDiscussionIdentifier } from '../../core/src/identifier.js';
import { normalizeUrl } from '../../core/src/url.js';
import { createShareIntentUrl } from '../../core/src/mastodon.js';
import { getSettings } from '../../core/src/storage.js';

// Create Context Menus
if (chrome.contextMenus) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'mudpie_share_page',
      title: 'Discuss on Mastodon (MUDP)',
      contexts: ['page', 'link']
    });

    chrome.contextMenus.create({
      id: 'mudpie_copy_tag',
      title: 'Copy MUDP Discussion Tag',
      contexts: ['page', 'link']
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
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
        if (chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: shareUrl });
        }
      } else if (info.menuItemId === 'mudpie_copy_tag') {
        const hashtag = `#${identifier}`;
        if (tab && tab.id && chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => navigator.clipboard.writeText(text),
            args: [hashtag]
          }).catch(() => {});
        }
      }
    } catch {
      // Gracefully ignore any context menu or tab handling errors
    }
  });
}
