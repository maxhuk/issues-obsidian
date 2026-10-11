import { normalizePath, type App } from 'obsidian';
import { stripFrontmatter } from '../view/util';

export async function readTemplateBody(app: App, path: string | null): Promise<string> {
	if (path === null) return '';
	const file = app.vault.getFileByPath(normalizePath(path));
	if (!file) return '';
	return stripFrontmatter(await app.vault.cachedRead(file));
}

export async function readBody(app: App, path: string): Promise<string> {
	const file = app.vault.getFileByPath(path);
	if (!file) return '';
	return stripFrontmatter(await app.vault.cachedRead(file));
}
