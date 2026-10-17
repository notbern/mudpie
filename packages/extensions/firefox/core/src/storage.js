/**
 * Mastodon URL Discussion Protocol (MUDP) - Storage & Configuration Module
 * Manages user settings across WebExtensions storage, localStorage, and memory.
 */

export const DEFAULT_SETTINGS = {
  instance: '',
  knownInstances: [],
  cacheTtlMinutes: 30,  // Local cache TTL in minutes: 15–60 min (RFC Section 11)
  openInNewTab: true,
  theme: 'auto' // 'auto', 'dark', 'light'
};

// In-memory fallback store
const defaultMemoryStore = new Map();

/**
 * Returns the browser storage API interface if available.
 */
function getStorageArea() {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync) {
    return browser.storage.sync;
  }
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    return browser.storage.local;
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    return {
      get: (keys) => new Promise((resolve) => chrome.storage.sync.get(keys, resolve)),
      set: (items) => new Promise((resolve) => chrome.storage.sync.set(items, resolve)),
      remove: (keys) => new Promise((resolve) => chrome.storage.sync.remove(keys, resolve))
    };
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return {
      get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
      set: (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve)),
      remove: (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
    };
  }
  if (typeof localStorage !== 'undefined') {
    return {
      get: async (keys) => {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          const val = localStorage.getItem(`mudpie_${k}`);
          if (val !== null) {
            try {
              result[k] = JSON.parse(val);
            } catch {
              result[k] = val;
            }
          }
        }
        return result;
      },
      set: async (items) => {
        for (const [k, v] of Object.entries(items)) {
          localStorage.setItem(`mudpie_${k}`, JSON.stringify(v));
        }
      },
      remove: async (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          localStorage.removeItem(`mudpie_${k}`);
        }
      }
    };
  }
  // In-memory fallback
  return {
    get: async (keys) => {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        if (defaultMemoryStore.has(k)) {
          result[k] = defaultMemoryStore.get(k);
        }
      }
      return result;
    },
    set: async (items) => {
      for (const [k, v] of Object.entries(items)) {
        defaultMemoryStore.set(k, v);
      }
    },
    remove: async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        defaultMemoryStore.delete(k);
      }
    }
  };
}

/**
 * Loads all settings merged with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  const storage = getStorageArea();
  try {
    const keys = Object.keys(DEFAULT_SETTINGS);
    const stored = await storage.get(keys);
    return {
      ...DEFAULT_SETTINGS,
      ...(stored || {})
    };
  } catch (err) {
    console.error('Failed to load settings:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves given settings.
 * @param {Partial<typeof DEFAULT_SETTINGS>} newSettings
 * @returns {Promise<void>}
 */
export async function saveSettings(newSettings) {
  const storage = getStorageArea();
  await storage.set(newSettings);
}
