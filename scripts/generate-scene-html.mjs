import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import nunjucks from 'nunjucks';
import ip from 'ip';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const COLORS = require('../src/constants/colors.js');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const ENTRY_TEMPLATE = path.join(SRC_DIR, 'scene.html');
const OUT_FILE = path.join(SRC_DIR, 'generated/scene.html');
const REQUIRE_RE = /<require\s+path="([^"]+)"><\/require>/g;

function envFlag (name) {
  const value = process.env[name];
  if (!value) { return false; }
  return value === '1' || value.toLowerCase() === 'true';
}

function expandRequireTags (filePath, seen = new Set()) {
  const normalizedPath = path.resolve(filePath);
  if (seen.has(normalizedPath)) {
    throw new Error(`Circular <require> include detected at ${normalizedPath}`);
  }

  seen.add(normalizedPath);
  let source = fs.readFileSync(normalizedPath, 'utf8');

  source = source.replace(REQUIRE_RE, (_, relativeIncludePath) => {
    const includeFromSrcRoot = path.resolve(SRC_DIR, relativeIncludePath);
    const includeFromCurrentDir = path.resolve(path.dirname(normalizedPath), relativeIncludePath);
    const includePath = fs.existsSync(includeFromSrcRoot) ? includeFromSrcRoot : includeFromCurrentDir;
    return expandRequireTags(includePath, new Set(seen));
  });

  return source;
}

function main () {
  const templateSource = expandRequireTags(ENTRY_TEMPLATE);
  const html = nunjucks.renderString(templateSource, {
    DEBUG_AFRAME: envFlag('DEBUG_AFRAME'),
    DEBUG_LOG: envFlag('DEBUG_LOG'),
    DEBUG_KEYBOARD: envFlag('DEBUG_KEYBOARD'),
    DEBUG_INSPECTOR: envFlag('DEBUG_INSPECTOR'),
    HOST: ip.address(),
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    COLORS
  });

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, html);
  process.stdout.write(`Generated ${path.relative(ROOT, OUT_FILE)}\n`);
}

main();
