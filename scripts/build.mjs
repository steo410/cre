import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
const check = spawnSync(process.execPath, ['scripts/verify-storage.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
mkdirSync('public', { recursive: true });
for (const file of ['morphs-data.js', 'morphs.js', 'morphs.css', 'index.html', 'app.js', 'cloud.js', 'sync-core.js', 'style.css', 'cloud.css', 'features.css', 'features-core.js', 'ledger.js', 'gallery.js']) {
  copyFileSync(file, 'public/' + file);
}
console.log('Static site prepared.');

