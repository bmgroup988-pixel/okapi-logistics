#!/usr/bin/env node
// Lance node --test sur les fichiers *<suffix> trouvés sous <dir>, en les
// énumérant nous-mêmes (fs.readdirSync récursif) plutôt que de compter sur
// un glob shell (`**`) — non supporté par `sh` (utilisé par npm sur
// Unix/CI) ni par `sh`/`bash` sans `globstar`, ce qui faisait échouer le
// test runner en lui passant le motif littéral, non développé, comme
// unique argument ("Could not find '.../dist/**/*.test.js'").
//
// Usage : node run-tests.mjs <dir> <suffix> [-- <extra node --test args>]
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const sepIndex = args.indexOf('--');
const [dir, suffix] = sepIndex === -1 ? args : args.slice(0, sepIndex);
const extraArgs = sepIndex === -1 ? [] : args.slice(sepIndex + 1);

if (!dir || !suffix) {
  console.error('Usage: node run-tests.mjs <dir> <suffix> [-- <extra node --test args>]');
  process.exit(1);
}

const root = resolve(dir);
const files = [];

function walk(d) {
  let entries;
  try {
    entries = readdirSync(d, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = join(d, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(suffix)) files.push(full);
  }
}
walk(root);

if (files.length === 0) {
  console.log(`Aucun fichier de test (*${suffix}) trouvé sous ${dir} — rien à exécuter.`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [...extraArgs, '--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
