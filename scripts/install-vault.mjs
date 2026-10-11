import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync('install.config.json')) {
	console.error('install.config.json is missing; copy install.config.example.json and set vaultPath.');
	process.exit(1);
}
const { vaultPath } = JSON.parse(readFileSync('install.config.json', 'utf8'));
const target = join(vaultPath, '.obsidian', 'plugins', 'issues');
mkdirSync(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	copyFileSync(file, join(target, file));
}
console.log(`Installed into ${target}`);
