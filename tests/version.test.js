import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getVersion, syncVersions } from '../scripts/build.js';

const ROOT_DIR = process.cwd();

test('Version Management - getVersion returns version from package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const version = getVersion(ROOT_DIR);
  assert.strictEqual(version, pkg.version);
});

test('Version Management - All project files match package.json version', () => {
  const version = getVersion(ROOT_DIR);

  const chromeManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'packages', 'extensions', 'chrome', 'manifest.json'), 'utf8')
  );
  assert.strictEqual(chromeManifest.version, version);

  const firefoxManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'packages', 'extensions', 'firefox', 'manifest.json'), 'utf8')
  );
  assert.strictEqual(firefoxManifest.version, version);

  const sharedOptionsHtml = fs.readFileSync(
    path.join(ROOT_DIR, 'packages', 'extensions', 'shared', 'options', 'options.html'),
    'utf8'
  );
  assert.match(sharedOptionsHtml, new RegExp(`Mudpie Browser Extension v${version.replace(/\./g, '\\.')}`));

  const sharedPopupHtml = fs.readFileSync(
    path.join(ROOT_DIR, 'packages', 'extensions', 'shared', 'popup', 'popup.html'),
    'utf8'
  );
  assert.match(sharedPopupHtml, new RegExp(`v${version.replace(/\./g, '\\.')}`));

  // Check Chrome copy of shared files if present
  const chromeOptionsPath = path.join(ROOT_DIR, 'packages', 'extensions', 'chrome', 'shared', 'options', 'options.html');
  if (fs.existsSync(chromeOptionsPath)) {
    const chromeOptionsHtml = fs.readFileSync(chromeOptionsPath, 'utf8');
    assert.match(chromeOptionsHtml, new RegExp(`Mudpie Browser Extension v${version.replace(/\./g, '\\.')}`));
  }

  const chromePopupPath = path.join(ROOT_DIR, 'packages', 'extensions', 'chrome', 'shared', 'popup', 'popup.html');
  if (fs.existsSync(chromePopupPath)) {
    const chromePopupHtml = fs.readFileSync(chromePopupPath, 'utf8');
    assert.match(chromePopupHtml, new RegExp(`v${version.replace(/\./g, '\\.')}`));
  }

  // Check Firefox copy of shared files if present
  const firefoxOptionsPath = path.join(ROOT_DIR, 'packages', 'extensions', 'firefox', 'shared', 'options', 'options.html');
  if (fs.existsSync(firefoxOptionsPath)) {
    const firefoxOptionsHtml = fs.readFileSync(firefoxOptionsPath, 'utf8');
    assert.match(firefoxOptionsHtml, new RegExp(`Mudpie Browser Extension v${version.replace(/\./g, '\\.')}`));
  }

  const firefoxPopupPath = path.join(ROOT_DIR, 'packages', 'extensions', 'firefox', 'shared', 'popup', 'popup.html');
  if (fs.existsSync(firefoxPopupPath)) {
    const firefoxPopupHtml = fs.readFileSync(firefoxPopupPath, 'utf8');
    assert.match(firefoxPopupHtml, new RegExp(`v${version.replace(/\./g, '\\.')}`));
  }

  const rfc = fs.readFileSync(path.join(ROOT_DIR, 'RFC.md'), 'utf8');
  assert.match(rfc, new RegExp(`\\*\\*Version:\\*\\*\\s*${version.replace(/\./g, '\\.')}`));
});

test('Version Management - syncVersions propagates new version across all files', () => {
  const originalVersion = getVersion(ROOT_DIR);
  const testVersion = '99.88.77';

  try {
    syncVersions(testVersion, ROOT_DIR);

    const chromeManifest = JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'packages', 'extensions', 'chrome', 'manifest.json'), 'utf8')
    );
    assert.strictEqual(chromeManifest.version, testVersion);

    const firefoxManifest = JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'packages', 'extensions', 'firefox', 'manifest.json'), 'utf8')
    );
    assert.strictEqual(firefoxManifest.version, testVersion);

    const sharedOptionsHtml = fs.readFileSync(
      path.join(ROOT_DIR, 'packages', 'extensions', 'shared', 'options', 'options.html'),
      'utf8'
    );
    assert.match(sharedOptionsHtml, new RegExp(`Mudpie Browser Extension v${testVersion.replace(/\./g, '\\.')}`));

    const sharedPopupHtml = fs.readFileSync(
      path.join(ROOT_DIR, 'packages', 'extensions', 'shared', 'popup', 'popup.html'),
      'utf8'
    );
    assert.match(sharedPopupHtml, new RegExp(`v${testVersion.replace(/\./g, '\\.')}`));

    const chromeOptionsPath = path.join(ROOT_DIR, 'packages', 'extensions', 'chrome', 'shared', 'options', 'options.html');
    if (fs.existsSync(chromeOptionsPath)) {
      const chromeOptionsHtml = fs.readFileSync(chromeOptionsPath, 'utf8');
      assert.match(chromeOptionsHtml, new RegExp(`Mudpie Browser Extension v${testVersion.replace(/\./g, '\\.')}`));
    }

    const chromePopupPath = path.join(ROOT_DIR, 'packages', 'extensions', 'chrome', 'shared', 'popup', 'popup.html');
    if (fs.existsSync(chromePopupPath)) {
      const chromePopupHtml = fs.readFileSync(chromePopupPath, 'utf8');
      assert.match(chromePopupHtml, new RegExp(`v${testVersion.replace(/\./g, '\\.')}`));
    }

    const firefoxOptionsPath = path.join(ROOT_DIR, 'packages', 'extensions', 'firefox', 'shared', 'options', 'options.html');
    if (fs.existsSync(firefoxOptionsPath)) {
      const firefoxOptionsHtml = fs.readFileSync(firefoxOptionsPath, 'utf8');
      assert.match(firefoxOptionsHtml, new RegExp(`Mudpie Browser Extension v${testVersion.replace(/\./g, '\\.')}`));
    }

    const firefoxPopupPath = path.join(ROOT_DIR, 'packages', 'extensions', 'firefox', 'shared', 'popup', 'popup.html');
    if (fs.existsSync(firefoxPopupPath)) {
      const firefoxPopupHtml = fs.readFileSync(firefoxPopupPath, 'utf8');
      assert.match(firefoxPopupHtml, new RegExp(`v${testVersion.replace(/\./g, '\\.')}`));
    }

    const rfc = fs.readFileSync(path.join(ROOT_DIR, 'RFC.md'), 'utf8');
    assert.match(rfc, new RegExp(`\\*\\*Version:\\*\\*\\s*${testVersion.replace(/\./g, '\\.')}`));
  } finally {
    // Restore original version
    syncVersions(originalVersion, ROOT_DIR);
  }
});
