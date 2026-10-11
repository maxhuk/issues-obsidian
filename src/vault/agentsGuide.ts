import type { App } from 'obsidian';
import type { ProjectConfig } from '../types';
import { renderAgentsGuide } from '../model/agentsGuide';
import { stripFrontmatter } from '../view/util';

export function agentsGuidePath(config: ProjectConfig): string {
	return config.folder === '' ? 'AGENTS.md' : `${config.folder}/AGENTS.md`;
}

/**
 * Keeps `<project folder>/AGENTS.md` equal to the guide rendered from the current configuration
 * and plugin version. Writes only when the body or the recorded version differs.
 */
export async function syncAgentsGuide(app: App, config: ProjectConfig, pluginVersion: string): Promise<boolean> {
	const path = agentsGuidePath(config);
	const body = renderAgentsGuide(config, pluginVersion);
	const existing = app.vault.getFileByPath(path);

	if (existing) {
		const current = await app.vault.cachedRead(existing);
		const version = app.metadataCache.getFileCache(existing)?.frontmatter?.issues_version as unknown;
		if (stripFrontmatter(current) === body && version === pluginVersion) return false;
		await app.vault.modify(existing, body);
		await app.fileManager.processFrontMatter(existing, (frontmatter: Record<string, unknown>) => {
			frontmatter.type = 'agents';
			frontmatter.issues_version = pluginVersion;
		});
		return true;
	}

	const file = await app.vault.create(path, body);
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		frontmatter.type = 'agents';
		frontmatter.issues_version = pluginVersion;
	});
	return true;
}
