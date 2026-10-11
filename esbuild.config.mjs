import esbuild from 'esbuild';
import process from 'process';
import { builtinModules } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';

const prod = process.argv[2] === 'production';
const devDir = 'dev-vault/.obsidian/plugins/issues';

if (!prod) {
	mkdirSync(devDir, { recursive: true });
	copyFileSync('manifest.json', `${devDir}/manifest.json`);
	copyFileSync('styles.css', `${devDir}/styles.css`);
}

const context = await esbuild.context({
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: [
		'obsidian',
		'electron',
		'@codemirror/autocomplete',
		'@codemirror/collab',
		'@codemirror/commands',
		'@codemirror/language',
		'@codemirror/lint',
		'@codemirror/search',
		'@codemirror/state',
		'@codemirror/view',
		'@lezer/common',
		'@lezer/highlight',
		'@lezer/lr',
		...builtinModules,
	],
	format: 'cjs',
	target: 'es2021',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: prod ? 'main.js' : `${devDir}/main.js`,
	minify: prod,
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
