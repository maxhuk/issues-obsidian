import type { Issue, NoteRecord, ProjectConfig, Release } from '../types';

export const KEY = 'BRE';

export function config(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		path: 'Projects/Breathe/Breathe.md',
		folder: 'Projects/Breathe',
		name: 'Breathe',
		key: KEY,
		releases: true,
		statuses: ['inbox', 'backlog', 'next', 'doing', 'pr', 'merged', 'released', 'canceled'],
		statusesClosed: ['released', 'canceled'],
		statusMeanings: {},
		statusReleased: 'released',
		statusShipFrom: 'merged',
		hideClosedAfterDays: 14,
		issuesFolder: 'Projects/Breathe/Issues',
		releasesFolder: 'Projects/Breathe/Releases',
		issueTemplate: null,
		...overrides,
	};
}

export function issue(overrides: Partial<Issue> = {}): Issue {
	const number = overrides.number ?? 1;
	const key = `${KEY}-${number}`;
	return {
		path: `Projects/Breathe/Issues/${key}.md`,
		key,
		number,
		title: `Issue ${number}`,
		project: KEY,
		type: 'task',
		status: 'backlog',
		priority: 'medium',
		labels: [],
		parent: null,
		release: null,
		order: null,
		created: '2026-01-01',
		closed: null,
		...overrides,
	};
}

export function release(overrides: Partial<Release> = {}): Release {
	const version = overrides.version ?? '1.0.0';
	const basename = `${KEY}-${version}`;
	return {
		path: `Projects/Breathe/Releases/${basename}.md`,
		basename,
		project: KEY,
		version,
		status: 'planned',
		released: null,
		...overrides,
	};
}

export function record(path: string, frontmatter: Record<string, unknown>): NoteRecord {
	const basename = path.split('/').at(-1)!.replace(/\.md$/, '');
	return { path, basename, frontmatter };
}
