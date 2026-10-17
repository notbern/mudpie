import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../packages/core/src/storage.js';

test('DEFAULT_SETTINGS - auto fetch is removed and no default instances are preset', () => {
  assert.strictEqual(DEFAULT_SETTINGS.cacheTtlMinutes, 30);
  assert.strictEqual(DEFAULT_SETTINGS.instance, '');
  assert.deepStrictEqual(DEFAULT_SETTINGS.knownInstances, []);
  assert.strictEqual(DEFAULT_SETTINGS.autoCheckBadge, undefined);
});

test('getSettings & saveSettings - handles settings persistence and fallback defaults', async () => {
  const initial = await getSettings();
  assert.strictEqual(initial.instance, '');

  await saveSettings({ instance: 'fosstodon.org', cacheTtlMinutes: 45 });
  const updated = await getSettings();
  assert.strictEqual(updated.instance, 'fosstodon.org');
  assert.strictEqual(updated.cacheTtlMinutes, 45);

  // Reset
  await saveSettings({ instance: '', cacheTtlMinutes: 30 });
  const reset = await getSettings();
  assert.strictEqual(reset.instance, '');
  assert.strictEqual(reset.cacheTtlMinutes, 30);
});
