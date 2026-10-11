import type { Issue, NoteRecord, Priority, Release } from '../types';

export interface Partition {
	projects: NoteRecord[];
	releases: Release[];
	issues: Issue[];
}

const KEY_PATTERN = /^([A-Z][A-Z0-9]*)-(\d+)$/;

export function parseKey(basename: string): { key: string; number: number } | null {
	const m = KEY_PATTERN.exec(basename);
	return m ? { key: basename, number: Number(m[2]) } : null;
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value !== '' ? value : null;
}

function strings(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v !== '');
	return typeof value === 'string' && value !== '' ? [value] : [];
}

/** `[[BRE-100]]`, `[[BRE-100|alias]]`, `[[Projects/Breathe/Issues/BRE-100]]` and a bare `BRE-100` all give `BRE-100`. */
export function linkBasename(value: unknown): string | null {
	const raw = text(value);
	if (raw === null) return null;
	const inner = raw.replace(/^\[\[|\]\]$/g, '').split('|')[0]!.split('#')[0]!;
	const last = inner.split('/').at(-1)!;
	return last === '' ? null : last.replace(/\.md$/, '');
}

function priority(value: unknown): Priority {
	return value === 'high' || value === 'low' ? value : 'medium';
}

export function toIssue(note: NoteRecord): Issue {
	const fm = note.frontmatter;
	const parsed = parseKey(note.basename);
	return {
		path: note.path,
		key: note.basename,
		number: parsed?.number ?? 0,
		title: text(fm.title) ?? note.basename,
		project: text(fm.project) ?? '',
		type: text(fm.type) ?? 'task',
		status: text(fm.status) ?? '',
		priority: priority(fm.priority),
		labels: strings(fm.labels),
		parent: linkBasename(fm.parent),
		release: linkBasename(fm.release),
		order: text(fm.order),
		created: text(fm.created),
		closed: text(fm.closed),
	};
}

export function toRelease(note: NoteRecord): Release {
	const fm = note.frontmatter;
	return {
		path: note.path,
		basename: note.basename,
		project: text(fm.project) ?? '',
		version: text(fm.version) ?? note.basename,
		status: fm.status === 'released' ? 'released' : 'planned',
		released: text(fm.released),
	};
}

/** Spec 2.2: a note that is neither a project nor a release is an issue. */
export function partition(notes: NoteRecord[]): Partition {
	const result: Partition = { projects: [], releases: [], issues: [] };
	for (const note of notes) {
		switch (note.frontmatter.type) {
			case 'project':
				result.projects.push(note);
				break;
			case 'release':
				result.releases.push(toRelease(note));
				break;
			default:
				result.issues.push(toIssue(note));
		}
	}
	return result;
}
