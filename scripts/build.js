import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = process.cwd();
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
const CORE_DIR = path.join(PACKAGES_DIR, 'core', 'src');
const EXTENSIONS_DIR = path.join(PACKAGES_DIR, 'extensions');
const SHARED_DIR = path.join(EXTENSIONS_DIR, 'shared');
const FIREFOX_DIR = path.join(EXTENSIONS_DIR, 'firefox');
const CHROME_DIR = path.join(EXTENSIONS_DIR, 'chrome');
const BOOKMARKLETS_DIR = path.join(PACKAGES_DIR, 'bookmarklets');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * Reads the authoritative version from package.json.
 */
export function getVersion(rootDir = ROOT_DIR) {
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.1.0';
  }
  return '0.1.0';
}

/**
 * Synchronizes the project version across manifests, templates, and documentation.
 */
export function syncVersions(version = null, rootDir = ROOT_DIR) {
  const resolvedVersion = version || getVersion(rootDir);
  const packagesDir = path.join(rootDir, 'packages');
  const extensionsDir = path.join(packagesDir, 'extensions');
  const distDir = path.join(rootDir, 'dist');
  const rfcPath = path.join(rootDir, 'RFC.md');

  console.log(`Syncing version ${resolvedVersion} across project files...`);

  function walkAndUpdate(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndUpdate(fullPath);
      } else if (entry.isFile()) {
        if (entry.name === 'manifest.json') {
          try {
            const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (manifest.version !== resolvedVersion) {
              manifest.version = resolvedVersion;
              fs.writeFileSync(fullPath, JSON.stringify(manifest, null, 2) + '\n');
              console.log(`  Updated ${path.relative(rootDir, fullPath)} to v${resolvedVersion}`);
            }
          } catch (e) {
            console.error(`  Error parsing manifest at ${fullPath}:`, e);
          }
        } else if (entry.name === 'options.html') {
          const content = fs.readFileSync(fullPath, 'utf8');
          const updated = content.replace(/(Mudpie Browser Extension v)[0-9a-zA-Z.-]+/g, `$1${resolvedVersion}`);
          if (updated !== content) {
            fs.writeFileSync(fullPath, updated);
            console.log(`  Updated ${path.relative(rootDir, fullPath)} to v${resolvedVersion}`);
          }
        } else if (entry.name === 'popup.html') {
          const content = fs.readFileSync(fullPath, 'utf8');
          const updated = content.replace(/(Mastodon URL Discussion Protocol v|Mudpie Browser Extension v|Mudpie v)[0-9a-zA-Z.-]+/g, `$1${resolvedVersion}`);
          if (updated !== content) {
            fs.writeFileSync(fullPath, updated);
            console.log(`  Updated ${path.relative(rootDir, fullPath)} to v${resolvedVersion}`);
          }
        }
      }
    }
  }

  // Walk all extension directories and files
  if (fs.existsSync(extensionsDir)) {
    walkAndUpdate(extensionsDir);
  }

  // Walk dist directory if it exists
  if (fs.existsSync(distDir)) {
    walkAndUpdate(distDir);
  }

  // Update RFC.md
  if (fs.existsSync(rfcPath)) {
    const content = fs.readFileSync(rfcPath, 'utf8');
    const updated = content.replace(/^(\*\*Version:\*\*\s*)[0-9a-zA-Z.-]+(.*)$/m, `$1${resolvedVersion}$2`);
    if (updated !== content) {
      fs.writeFileSync(rfcPath, updated);
      console.log(`  Updated RFC.md to v${resolvedVersion}`);
    }
  }

  return resolvedVersion;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Creates an uncompressed or standard zip file from a directory.
 */
function createZip(sourceDir, outPath) {
  // Pure JS simple ZIP archiver
  const files = [];

  function collectFiles(dir, relPrefix = '') {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;
      if (item.isDirectory()) {
        collectFiles(fullPath, relPath);
      } else {
        files.push({
          relPath,
          data: fs.readFileSync(fullPath)
        });
      }
    }
  }

  collectFiles(sourceDir);

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  for (const file of files) {
    const nameBuf = Buffer.from(file.relPath, 'utf8');
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression (0 = store)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // comp size
    localHeader.writeUInt32LE(size, 22); // uncomp size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, file.data);

    // Central directory header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // compression
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0, 14); // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attr
    centralHeader.writeUInt32LE(0, 38); // external attr
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  const zipBuffer = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
  fs.writeFileSync(outPath, zipBuffer);
  console.log(`Created zip: ${outPath} (${zipBuffer.length} bytes)`);
}

function buildFirefoxExtension() {
  console.log('Building Firefox Extension...');
  const distFirefox = path.join(DIST_DIR, 'firefox');
  fs.mkdirSync(distFirefox, { recursive: true });

  // Copy manifest & background
  fs.copyFileSync(path.join(FIREFOX_DIR, 'manifest.json'), path.join(distFirefox, 'manifest.json'));
  fs.copyFileSync(path.join(FIREFOX_DIR, 'background.js'), path.join(distFirefox, 'background.js'));

  // Copy shared & core into dist
  copyDirRecursive(SHARED_DIR, path.join(distFirefox, 'shared'));
  copyDirRecursive(CORE_DIR, path.join(distFirefox, 'core', 'src'));

  // Also sync shared and core directly inside packages/extensions/firefox for direct temporary addon loading
  copyDirRecursive(SHARED_DIR, path.join(FIREFOX_DIR, 'shared'));
  copyDirRecursive(CORE_DIR, path.join(FIREFOX_DIR, 'core', 'src'));

  // Package zip and xpi
  createZip(distFirefox, path.join(DIST_DIR, 'mudpie-firefox.zip'));
  createZip(distFirefox, path.join(DIST_DIR, 'mudpie-firefox.xpi'));
}

function buildChromeExtension() {
  console.log('Building Chrome Extension...');
  const distChrome = path.join(DIST_DIR, 'chrome');
  fs.mkdirSync(distChrome, { recursive: true });

  // Copy manifest & background
  fs.copyFileSync(path.join(CHROME_DIR, 'manifest.json'), path.join(distChrome, 'manifest.json'));
  fs.copyFileSync(path.join(CHROME_DIR, 'background.js'), path.join(distChrome, 'background.js'));

  // Copy shared & core into dist
  copyDirRecursive(SHARED_DIR, path.join(distChrome, 'shared'));
  copyDirRecursive(CORE_DIR, path.join(distChrome, 'core', 'src'));

  // Sync to chrome dir
  copyDirRecursive(SHARED_DIR, path.join(CHROME_DIR, 'shared'));
  copyDirRecursive(CORE_DIR, path.join(CHROME_DIR, 'core', 'src'));

  // Package zip
  createZip(distChrome, path.join(DIST_DIR, 'mudpie-chrome.zip'));
}

function minifyJsForBookmarklet(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBookmarklets() {
  console.log('Building Bookmarklets...');
  const viewCode = fs.readFileSync(path.join(BOOKMARKLETS_DIR, 'mudpie-view.js'), 'utf8');
  const shareCode = fs.readFileSync(path.join(BOOKMARKLETS_DIR, 'mudpie-share.js'), 'utf8');

  const minView = encodeURIComponent(minifyJsForBookmarklet(viewCode));
  const minShare = encodeURIComponent(minifyJsForBookmarklet(shareCode));

  const viewBookmarklet = `javascript:${minView}`;
  const shareBookmarklet = `javascript:${minShare}`;

  const readmeContent = `# Mudpie Bookmarklets

Bookmarklets allow you to use the Mastodon URL Discussion Protocol (MUDP) directly from your browser's bookmarks bar without installing browser extensions.

## Available Bookmarklets

### 1. Mudpie - View Discussions
Extracts the canonical URL of the current page, calculates the SHA-256 MUDP identifier (e.g. \`#MUDP_9eba6b3c57ce169e19742b249a7f7542a620751a5c4b2f2c4990684f7e655f70\`), and opens the hashtag search on your Mastodon instance.

**Bookmarklet Link:**
\`\`\`javascript
${viewBookmarklet}
\`\`\`

### 2. Mudpie - Share / Discuss Page
Formats a compliant MUDP post with the canonical URL and discussion hashtags, and opens your Mastodon Web Composer.

**Bookmarklet Link:**
\`\`\`javascript
${shareBookmarklet}
\`\`\`

## Installation
1. Create a new bookmark in your browser.
2. Set the Name to **"Mudpie - View"** or **"Mudpie - Discuss"**.
3. Paste the \`javascript:...\` code above into the **URL / Location** field.
4. Click the bookmark when viewing any article or webpage!
`;

  fs.writeFileSync(path.join(BOOKMARKLETS_DIR, 'README.md'), readmeContent);
  console.log('Generated packages/bookmarklets/README.md');
}

export function buildAll(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const version = options.version || getVersion(rootDir);
  syncVersions(version, rootDir);
  fs.mkdirSync(DIST_DIR, { recursive: true });
  buildFirefoxExtension();
  buildChromeExtension();
  buildBookmarklets();
}

export { buildFirefoxExtension, buildChromeExtension, buildBookmarklets };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('Starting Mudpie Build...');
  buildAll();
  console.log('Build completed successfully.');
}
