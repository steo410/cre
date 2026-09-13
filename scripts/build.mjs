import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
const check = spawnSync(process.execPath, ['scripts/verify-storage.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
mkdirSync('public', { recursive: true });
for (const file of ['index.html', 'app.js', 'cloud.js', 'sync-core.js', 'style.css', 'cloud.css']) {
  copyFileSync(file, 'public/' + file);
}
console.log('Static site prepared.');
