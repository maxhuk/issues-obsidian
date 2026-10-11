import type { App, BasesEntry } from 'obsidian';
import type { NoteRecord } from '../types';

/** Frontmatter as Obsidian parsed it, which is what agents and the plugin both write. */
export function toRecords(app: App, entries: BasesEntry[]): NoteRecord[] {
	return entries.map((entry) => {
		const cached = app.metadataCache.getFileCache(entry.file)?.frontmatter ?? {};
		const frontmatter: Record<string, unknown> = { ...cached };
		delete frontmatter.position;
		return { path: entry.file.path, basename: entry.file.basename, frontmatter };
	});
}
