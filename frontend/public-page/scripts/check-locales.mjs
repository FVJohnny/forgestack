#!/usr/bin/env node
// Fails if any locale's key set differs from the base (en) locale, so a
// missing or extra translation key is caught in CI instead of silently
// falling back to English at runtime.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');
const BASE = 'en';

function keyset(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) keyset(v, path, out);
    else out.add(path);
  }
  return out;
}

const load = (loc) => JSON.parse(readFileSync(join(messagesDir, `${loc}.json`), 'utf8'));
const locales = readdirSync(messagesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

const base = keyset(load(BASE));
let failed = false;

for (const loc of locales) {
  if (loc === BASE) continue;
  const keys = keyset(load(loc));
  const missing = [...base].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !base.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n✖ ${loc}.json differs from ${BASE}.json:`);
    missing.forEach((k) => console.error(`   missing: ${k}`));
    extra.forEach((k) => console.error(`   extra:   ${k}`));
  }
}

if (failed) {
  console.error('\nLocale key sets are out of sync. Fix the keys above.');
  process.exit(1);
}
console.log(`✓ All ${locales.length} locales match ${BASE}.json`);
