import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAll, verifyPackage } from '../scripts/build.js';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');

test('Package Build - Generates valid Firefox and Chrome extension packages', () => {
  buildAll();

  const firefoxXpi = path.join(DIST_DIR, 'mudpie-firefox.xpi');
  const firefoxZip = path.join(DIST_DIR, 'mudpie-firefox.zip');
  const chromeZip = path.join(DIST_DIR, 'mudpie-chrome.zip');

  assert.ok(fs.existsSync(firefoxXpi), 'mudpie-firefox.xpi must exist');
  assert.ok(fs.existsSync(firefoxZip), 'mudpie-firefox.zip must exist');
  assert.ok(fs.existsSync(chromeZip), 'mudpie-chrome.zip must exist');

  assert.ok(verifyPackage(firefoxXpi), 'mudpie-firefox.xpi must pass package verification');
  assert.ok(verifyPackage(firefoxZip), 'mudpie-firefox.zip must pass package verification');
  assert.ok(verifyPackage(chromeZip), 'mudpie-chrome.zip must pass package verification');
});

test('Package Verification - Rejects corrupted or invalid packages', () => {
  const invalidZipPath = path.join(DIST_DIR, 'invalid-test.zip');

  // 1. Missing file
  assert.throws(() => {
    verifyPackage(path.join(DIST_DIR, 'nonexistent.zip'));
  }, /Package verification failed/);

  // 2. Truncated file
  fs.writeFileSync(invalidZipPath, Buffer.from([0x00, 0x01, 0x02]));
  try {
    assert.throws(() => {
      verifyPackage(invalidZipPath);
    }, /Package verification failed/);
  } finally {
    if (fs.existsSync(invalidZipPath)) fs.unlinkSync(invalidZipPath);
  }
});
