/**
 * Mastodon URL Discussion Protocol (MUDP) - Extension Popup Controller
 */

import { normalizeUrl, getCanonicalUrl } from '../../core/src/url.js';
import { generateDiscussionIdentifier, getDiscussionHashtag } from '../../core/src/identifier.js';
import { formatMudpPost } from '../../core/src/post.js';
import { fetchDiscussion, createShareIntentUrl, normalizeInstance } from '../../core/src/mastodon.js';
import { getSettings, saveSettings } from '../../core/src/storage.js';

// DOM Elements
const pageTitleEl = document.getElementById('pageTitle');
const canonicalUrlEl = document.getElementById('canonicalUrlDisplay');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const identifierBadgeEl = document.getElementById('identifierBadge');
const instanceSelectEl = document.getElementById('instanceSelect');
const refreshBtn = document.getElementById('refreshBtn');
const openOptionsBtn = document.getElementById('openOptionsBtn');

const tabDiscussionsBtn = document.getElementById('tabDiscussions');
const tabComposeBtn = document.getElementById('tabCompose');
const paneDiscussions = document.getElementById('paneDiscussions');
const paneCompose = document.getElementById('paneCompose');
const discussionsCountBadge = document.getElementById('discussionsCount');

const loadingIndicator = document.getElementById('loadingIndicator');
const errorState = document.getElementById('errorState');
const errorMessageEl = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const emptyState = document.getElementById('emptyState');
const emptyInstanceNameEl = document.getElementById('emptyInstanceName');
const startDiscussionBtn = document.getElementById('startDiscussionBtn');
const postsListEl = document.getElementById('postsList');

const composeForm = document.getElementById('composeForm');
const commentInput = document.getElementById('commentInput');
const cwInput = document.getElementById('cwInput');
const postPreviewTextEl = document.getElementById('postPreviewText');
const shareWebBtn = document.getElementById('shareWebBtn');

// State
let currentTab = null;
let currentCanonicalUrl = '';
let currentRawUrl = '';
let currentIdentifier = '';
let currentSettings = null;
let activeInstance = '';

/**
 * Cross-browser extension API wrapper
 */
const browserApi = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined') ? chrome : null;

async function getActiveBrowserTab() {
  if (!browserApi || !browserApi.tabs) return null;
  const tabs = await new Promise(resolve => {
    browserApi.tabs.query({ active: true, currentWindow: true }, resolve);
  });
  return (tabs && tabs.length > 0) ? tabs[0] : null;
}

async function requestPageDetails(tab) {
  if (!tab || !tab.id) {
    return {
      title: 'Active Tab',
      canonicalUrl: 'https://example.com',
      rawUrl: 'https://example.com'
    };
  }

  // Handle browser internal pages
  if (tab.url && (tab.url.startsWith('about:') || tab.url.startsWith('chrome:') || tab.url.startsWith('edge:') || tab.url.startsWith('moz-extension:'))) {
    return {
      title: tab.title || 'Browser Page',
      canonicalUrl: tab.url,
      rawUrl: tab.url
    };
  }

  try {
    const response = await new Promise((resolve) => {
      browserApi.tabs.sendMessage(tab.id, { type: 'MUDP_GET_PAGE_INFO' }, (res) => {
        if (browserApi.runtime && browserApi.runtime.lastError) {
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });
    if (response && response.canonicalUrl) {
      return response;
    }
  } catch {
    // Content script not ready or unavailable
  }

  return {
    title: tab.title || 'Web Page',
    canonicalUrl: tab.url ? normalizeUrl(tab.url) : '',
    rawUrl: tab.url || ''
  };
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return `${Math.max(1, diffSec)}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: past.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function sanitizeAndRenderHtml(htmlString, containerEl) {
  containerEl.innerHTML = '';
  if (!htmlString) return;

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(htmlString, 'text/html');

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      // Allowed tags
      if (['p', 'br', 'span', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'a'].includes(tag)) {
        const el = document.createElement(tag);
        if (tag === 'a') {
          const href = node.getAttribute('href');
          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            el.setAttribute('href', href);
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        }
        for (const child of node.childNodes) {
          const cleanedChild = cleanNode(child);
          if (cleanedChild) el.appendChild(cleanedChild);
        }
        return el;
      } else {
        // Flatten unallowed containers into a span
        const span = document.createElement('span');
        for (const child of node.childNodes) {
          const cleanedChild = cleanNode(child);
          if (cleanedChild) span.appendChild(cleanedChild);
        }
        return span;
      }
    }
    return null;
  }

  for (const child of parsedDoc.body.childNodes) {
    const cleaned = cleanNode(child);
    if (cleaned) containerEl.appendChild(cleaned);
  }
}

function createPostCardElement(post) {
  const card = document.createElement('article');
  card.className = 'post-card';

  // Header
  const header = document.createElement('div');
  header.className = 'post-header';

  const avatar = document.createElement('img');
  avatar.className = 'post-avatar';
  avatar.src = post.account.avatarStatic || post.account.avatar || '../icons/icon-32.png';
  avatar.alt = post.account.displayName;
  avatar.loading = 'lazy';

  const authorMeta = document.createElement('div');
  authorMeta.className = 'post-author-meta';

  const authorName = document.createElement('a');
  authorName.className = 'post-author-name';
  authorName.href = post.account.url || '#';
  authorName.target = '_blank';
  authorName.rel = 'noopener noreferrer';
  authorName.textContent = post.account.displayName || post.account.username;

  const authorHandle = document.createElement('div');
  authorHandle.className = 'post-author-handle';
  authorHandle.textContent = `@${post.account.acct}`;

  authorMeta.appendChild(authorName);
  authorMeta.appendChild(authorHandle);

  const timeLink = document.createElement('a');
  timeLink.className = 'post-time';
  timeLink.href = post.url;
  timeLink.target = '_blank';
  timeLink.rel = 'noopener noreferrer';
  timeLink.textContent = formatRelativeTime(post.createdAt);

  header.appendChild(avatar);
  header.appendChild(authorMeta);
  header.appendChild(timeLink);
  card.appendChild(header);

  // Content Warning (if present)
  let contentEl = document.createElement('div');
  contentEl.className = 'post-content';

  if (post.spoilerText) {
    const cwBox = document.createElement('div');
    cwBox.className = 'cw-box';

    const cwLabel = document.createElement('span');
    cwLabel.textContent = `CW: ${post.spoilerText}`;

    const cwBtn = document.createElement('button');
    cwBtn.className = 'cw-btn';
    cwBtn.textContent = 'Show more';

    cwBox.appendChild(cwLabel);
    cwBox.appendChild(cwBtn);
    card.appendChild(cwBox);

    contentEl.classList.add('hidden');
    cwBox.addEventListener('click', () => {
      const isHidden = contentEl.classList.contains('hidden');
      if (isHidden) {
        contentEl.classList.remove('hidden');
        cwBtn.textContent = 'Show less';
      } else {
        contentEl.classList.add('hidden');
        cwBtn.textContent = 'Show more';
      }
    });
  }

  sanitizeAndRenderHtml(post.content, contentEl);
  card.appendChild(contentEl);

  // Footer (Stats & Link)
  const footer = document.createElement('div');
  footer.className = 'post-footer';

  const stats = document.createElement('div');
  stats.className = 'post-stats';

  const replyStat = document.createElement('span');
  replyStat.className = 'post-stat-item';
  replyStat.textContent = `💬 ${post.repliesCount}`;

  const boostStat = document.createElement('span');
  boostStat.className = 'post-stat-item';
  boostStat.textContent = `🔁 ${post.reblogsCount}`;

  const favStat = document.createElement('span');
  favStat.className = 'post-stat-item';
  favStat.textContent = `⭐ ${post.favouritesCount}`;

  stats.appendChild(replyStat);
  stats.appendChild(boostStat);
  stats.appendChild(favStat);

  const openLink = document.createElement('a');
  openLink.className = 'post-open-link';
  openLink.href = post.url;
  openLink.target = '_blank';
  openLink.rel = 'noopener noreferrer';
  openLink.textContent = 'View on Mastodon ↗';

  footer.appendChild(stats);
  footer.appendChild(openLink);
  card.appendChild(footer);

  return card;
}

async function loadDiscussions(bypassCache = false) {
  if (!currentCanonicalUrl || !currentIdentifier) return;

  if (!activeInstance) {
    loadingIndicator.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessageEl.textContent = 'Please configure your Mastodon instance in settings or select "+ Add instance...".';
    return;
  }

  loadingIndicator.classList.remove('hidden');
  errorState.classList.add('hidden');
  emptyState.classList.add('hidden');
  postsListEl.innerHTML = '';
  emptyInstanceNameEl.textContent = activeInstance;

  try {
    const ttlMinutes = Math.max(15, Math.min(60, currentSettings?.cacheTtlMinutes || 30));
    const result = await fetchDiscussion({
      url: currentCanonicalUrl,
      identifier: currentIdentifier,
      instance: activeInstance,
      bypassCache,
      cacheTtlMs: ttlMinutes * 60 * 1000
    });

    loadingIndicator.classList.add('hidden');
    const posts = result.posts || [];
    discussionsCountBadge.textContent = posts.length.toString();

    if (posts.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      for (const post of posts) {
        const postCard = createPostCardElement(post);
        postsListEl.appendChild(postCard);
      }
    }
  } catch (err) {
    loadingIndicator.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessageEl.textContent = err.message || 'Failed to fetch discussions.';
  }
}

async function updatePreview() {
  if (!currentCanonicalUrl) return;
  const userText = commentInput.value;
  const formatted = await formatMudpPost({
    url: currentRawUrl || currentCanonicalUrl,
    text: userText,
    identifier: currentIdentifier
  });
  postPreviewTextEl.textContent = formatted;
}

function setupInstanceOptions(settings) {
  instanceSelectEl.innerHTML = '';
  const known = (settings.knownInstances || []).filter(Boolean);
  
  if (settings.instance && !known.includes(settings.instance)) {
    known.unshift(settings.instance);
  }

  if (known.length === 0) {
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'No instance configured';
    instanceSelectEl.appendChild(defaultOpt);
  }

  for (const inst of known) {
    const opt = document.createElement('option');
    opt.value = inst;
    opt.textContent = inst;
    if (inst === settings.instance) {
      opt.selected = true;
    }
    instanceSelectEl.appendChild(opt);
  }

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '+ Add instance...';
  instanceSelectEl.appendChild(customOpt);

  activeInstance = settings.instance || (known.length > 0 ? known[0] : '');
}

async function initialize() {
  currentSettings = await getSettings();
  setupInstanceOptions(currentSettings);

  currentTab = await getActiveBrowserTab();
  const pageDetails = await requestPageDetails(currentTab);

  pageTitleEl.textContent = pageDetails.title || 'Current Web Page';
  currentCanonicalUrl = pageDetails.canonicalUrl || (currentTab?.url ? normalizeUrl(currentTab.url) : '');
  currentRawUrl = pageDetails.rawUrl || currentTab?.url || '';
  canonicalUrlEl.textContent = currentCanonicalUrl || 'No active URL';
  canonicalUrlEl.title = currentCanonicalUrl;

  if (currentCanonicalUrl) {
    currentIdentifier = await generateDiscussionIdentifier(currentCanonicalUrl);
    const hashtag = getDiscussionHashtag(currentIdentifier);
    identifierBadgeEl.querySelector('.tag-hash').textContent = hashtag;
    identifierBadgeEl.title = `Click to copy discussion tag (${hashtag})`;
    updatePreview();
    loadDiscussions();
  } else {
    loadingIndicator.classList.add('hidden');
    emptyState.classList.remove('hidden');
  }
}

// Event Listeners
tabDiscussionsBtn.addEventListener('click', () => {
  tabDiscussionsBtn.classList.add('active');
  tabComposeBtn.classList.remove('active');
  paneDiscussions.classList.remove('hidden');
  paneCompose.classList.add('hidden');
});

tabComposeBtn.addEventListener('click', () => {
  tabComposeBtn.classList.add('active');
  tabDiscussionsBtn.classList.remove('active');
  paneCompose.classList.remove('hidden');
  paneDiscussions.classList.add('hidden');
  updatePreview();
  commentInput.focus();
});

startDiscussionBtn.addEventListener('click', () => {
  tabComposeBtn.click();
});

instanceSelectEl.addEventListener('change', async (e) => {
  if (e.target.value === '__custom__') {
    const entered = prompt('Enter Mastodon instance host (e.g. fosstodon.org):');
    if (entered && entered.trim()) {
      const normalized = normalizeInstance(entered);
      if (normalized) {
        const known = currentSettings.knownInstances || [];
        if (!known.includes(normalized)) {
          known.push(normalized);
          await saveSettings({ knownInstances: known, instance: normalized });
        } else {
          await saveSettings({ instance: normalized });
        }
        currentSettings.instance = normalized;
        currentSettings.knownInstances = known;
        setupInstanceOptions(currentSettings);
        activeInstance = normalized;
        loadDiscussions();
        return;
      }
    }
    instanceSelectEl.value = activeInstance;
  } else {
    activeInstance = e.target.value;
    if (activeInstance) {
      await saveSettings({ instance: activeInstance });
      if (currentSettings) currentSettings.instance = activeInstance;
    }
    loadDiscussions();
  }
});

refreshBtn.addEventListener('click', () => {
  loadDiscussions(true);
});

retryBtn.addEventListener('click', () => {
  loadDiscussions(true);
});

copyUrlBtn.addEventListener('click', async () => {
  if (currentCanonicalUrl) {
    await navigator.clipboard.writeText(currentCanonicalUrl);
    const orig = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    setTimeout(() => { copyUrlBtn.textContent = orig; }, 1500);
  }
});

identifierBadgeEl.addEventListener('click', async () => {
  if (currentIdentifier) {
    const hashtag = getDiscussionHashtag(currentIdentifier);
    await navigator.clipboard.writeText(hashtag);
    const badgeText = identifierBadgeEl.querySelector('.tag-hash');
    const orig = badgeText.textContent;
    badgeText.textContent = 'Copied tag!';
    setTimeout(() => { badgeText.textContent = orig; }, 1500);
  }
});

openOptionsBtn.addEventListener('click', () => {
  if (browserApi && browserApi.runtime && browserApi.runtime.openOptionsPage) {
    browserApi.runtime.openOptionsPage();
  } else if (browserApi && browserApi.tabs) {
    browserApi.tabs.create({ url: '../options/options.html' });
  }
});

commentInput.addEventListener('input', updatePreview);

async function handleShare() {
  if (!currentCanonicalUrl) return;
  if (!activeInstance) {
    alert('Please configure a Mastodon instance in settings or select one first.');
    return;
  }
  const userText = commentInput.value;
  const shareUrl = await createShareIntentUrl({
    url: currentRawUrl || currentCanonicalUrl,
    text: userText,
    instance: activeInstance,
    identifier: currentIdentifier
  });

  if (browserApi && browserApi.tabs) {
    browserApi.tabs.create({ url: shareUrl });
  } else {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }
}

shareWebBtn.addEventListener('click', handleShare);

composeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleShare();
});

// Run initialization
document.addEventListener('DOMContentLoaded', initialize);
