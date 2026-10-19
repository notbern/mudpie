import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
});

test('Version Management - syncVersions propagates new version across all files in sandbox', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mudpie-version-test-'));
  const testVersion = '99.88.77';

  try {
    const chromeDir = path.join(tempDir, 'packages', 'extensions', 'chrome');
    const firefoxDir = path.join(tempDir, 'packages', 'extensions', 'firefox');
    const sharedDir = path.join(tempDir, 'packages', 'extensions', 'shared');
    const chromeSharedDir = path.join(chromeDir, 'shared');
    const firefoxSharedDir = path.join(firefoxDir, 'shared');

    fs.mkdirSync(path.join(chromeDir, 'shared', 'options'), { recursive: true });
    fs.mkdirSync(path.join(chromeDir, 'shared', 'popup'), { recursive: true });
    fs.mkdirSync(path.join(firefoxDir, 'shared', 'options'), { recursive: true });
    fs.mkdirSync(path.join(firefoxDir, 'shared', 'popup'), { recursive: true });
    fs.mkdirSync(path.join(sharedDir, 'options'), { recursive: true });
    fs.mkdirSync(path.join(sharedDir, 'popup'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'mudpie', version: '0.1.0' }, null, 2));
    fs.writeFileSync(path.join(chromeDir, 'manifest.json'), JSON.stringify({ name: 'Mudpie', version: '0.1.0' }, null, 2));
    fs.writeFileSync(path.join(firefoxDir, 'manifest.json'), JSON.stringify({ name: 'Mudpie', version: '0.1.0' }, null, 2));
    fs.writeFileSync(path.join(sharedDir, 'options', 'options.html'), '<span>Mudpie Browser Extension v0.1.0</span>');
    fs.writeFileSync(path.join(sharedDir, 'popup', 'popup.html'), '<span class="footer-note">Mastodon URL Discussion Protocol v0.1.0</span>');
    fs.writeFileSync(path.join(chromeSharedDir, 'options', 'options.html'), '<span>Mudpie Browser Extension v0.1.0</span>');
    fs.writeFileSync(path.join(chromeSharedDir, 'popup', 'popup.html'), '<span class="footer-note">Mastodon URL Discussion Protocol v0.1.0</span>');
    fs.writeFileSync(path.join(firefoxSharedDir, 'options', 'options.html'), '<span>Mudpie Browser Extension v0.1.0</span>');
    fs.writeFileSync(path.join(firefoxSharedDir, 'popup', 'popup.html'), '<span class="footer-note">Mastodon URL Discussion Protocol v0.1.0</span>');
    fs.writeFileSync(path.join(tempDir, 'RFC.md'), '# Title\n\n**Version:** 0.1.0 Draft\n');

    syncVersions(testVersion, tempDir);

    const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
    assert.strictEqual(updatedPkg.version, testVersion);

    const updatedChrome = JSON.parse(fs.readFileSync(path.join(chromeDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(updatedChrome.version, testVersion);

    const updatedFirefox = JSON.parse(fs.readFileSync(path.join(firefoxDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(updatedFirefox.version, testVersion);

    const updatedSharedOpt = fs.readFileSync(path.join(sharedDir, 'options', 'options.html'), 'utf8');
    assert.match(updatedSharedOpt, new RegExp(`Mudpie Browser Extension v${testVersion.replace(/\./g, '\\.')}`));

    const updatedSharedPop = fs.readFileSync(path.join(sharedDir, 'popup', 'popup.html'), 'utf8');
    assert.match(updatedSharedPop, new RegExp(`v${testVersion.replace(/\./g, '\\.')}`));

    const updatedChromeOpt = fs.readFileSync(path.join(chromeSharedDir, 'options', 'options.html'), 'utf8');
    assert.match(updatedChromeOpt, new RegExp(`Mudpie Browser Extension v${testVersion.replace(/\./g, '\\.')}`));

    const updatedChromePop = fs.readFileSync(path.join(chromeSharedDir, 'popup', 'popup.html'), 'utf8');
    assert.match(updatedChromePop, new RegExp(`v${testVersion.replace(/\./g, '\\.')}`));

    const updatedFirefoxOpt = fs.readFileSync(path.join(firefoxSharedDir, 'options', 'options.html'), 'utf8');
    assert.match(updatedFirefoxOpt, new RegExp(`Mudpie Browser Extension v${testVersion.replace(/\./g, '\\.')}`));

    const updatedFirefoxPop = fs.readFileSync(path.join(firefoxSharedDir, 'popup', 'popup.html'), 'utf8');
    assert.match(updatedFirefoxPop, new RegExp(`v${testVersion.replace(/\./g, '\\.')}`));

    // RFC.md must remain unchanged as RFC versioning is independent from implementation versioning
    const updatedRfc = fs.readFileSync(path.join(tempDir, 'RFC.md'), 'utf8');
    assert.strictEqual(updatedRfc, '# Title\n\n**Version:** 0.1.0 Draft\n');

    // Test patch bumping
    syncVersions('patch', tempDir);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8')).version, '99.88.78');

    // Test minor bumping
    syncVersions('minor', tempDir);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8')).version, '99.89.0');

    // Test major bumping
    syncVersions('major', tempDir);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8')).version, '100.0.0');

    // Test leading 'v' stripping
    syncVersions('v1.2.3', tempDir);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8')).version, '1.2.3');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
