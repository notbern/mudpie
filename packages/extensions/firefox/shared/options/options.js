/**
 * Mastodon URL Discussion Protocol (MUDP) - Options Controller
 */

import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../../../core/src/storage.js';
import { normalizeInstance } from '../../../core/src/mastodon.js';

const defaultInstanceEl = document.getElementById('defaultInstance');
const knownInstancesInputEl = document.getElementById('knownInstancesInput');
const cacheTtlMinutesEl = document.getElementById('cacheTtlMinutes');
const settingsForm = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const saveStatusEl = document.getElementById('saveStatus');

async function loadFormValues() {
  const settings = await getSettings();
  defaultInstanceEl.value = settings.instance || DEFAULT_SETTINGS.instance;
  knownInstancesInputEl.value = (settings.knownInstances || DEFAULT_SETTINGS.knownInstances).join(', ');
  if (cacheTtlMinutesEl) {
    cacheTtlMinutesEl.value = settings.cacheTtlMinutes || DEFAULT_SETTINGS.cacheTtlMinutes;
  }
}

function showStatus(text, isError = false) {
  saveStatusEl.textContent = text;
  saveStatusEl.style.color = isError ? 'var(--danger)' : 'var(--success)';
  setTimeout(() => {
    saveStatusEl.textContent = '';
  }, 3000);
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const instance = normalizeInstance(defaultInstanceEl.value.trim());
  if (!instance) {
    showStatus('Please enter a valid Mastodon instance.', true);
    return;
  }

  const knownInstances = knownInstancesInputEl.value
    .split(',')
    .map(s => normalizeInstance(s.trim()))
    .filter(Boolean);

  if (!knownInstances.includes(instance)) {
    knownInstances.unshift(instance);
  }

  const cacheTtlMinutes = Math.max(15, Math.min(60, parseInt(cacheTtlMinutesEl?.value || '30', 10) || 30));

  await saveSettings({
    instance,
    knownInstances,
    cacheTtlMinutes
  });

  showStatus('✓ Settings saved successfully!');
});

resetBtn.addEventListener('click', async () => {
  if (confirm('Reset all settings to default values?')) {
    await saveSettings(DEFAULT_SETTINGS);
    await loadFormValues();
    showStatus('✓ Reset to defaults.');
  }
});

document.addEventListener('DOMContentLoaded', loadFormValues);
