import type { CreateNote, Frontmatter, Issue, ProjectConfig } from '../types';
import { parseKey } from './partition';
import { isClosed, isReleasedStatus } from './project';
import { wikilink } from './status';

/** Spec 2.2: highest number present for the project's key, plus one. */
export function nextNumber(issues: Issue[], key: string): number {
	let max = 0;
	for (const issue of issues) {
		const parsed = parseKey(issue.key);
		if (parsed && issue.key.startsWith(`${key}-`)) max = Math.max(max, parsed.number);
	}
	return max + 1;
}

export function issuePath(config: ProjectConfig, number: number): string {
	return `${config.issuesFolder}/${config.key}-${number}.md`;
}

export function releaseBasename(key: string, version: string): string {
	return `${key}-${version}`;
}

export function releasePath(config: ProjectConfig, version: string): string {
	return `${config.releasesFolder}/${releaseBasename(config.key, version)}.md`;
}

export interface CreateIssueArgs {
	config: ProjectConfig;
	issues: Issue[];
	title: string;
	status: string;
	order: string;
	today: string;
	templateBody?: string;
	/** Basename of the release note; required when the status is `status_released`. */
	release?: string;
}

/** Spec 3.4: exact creation frontmatter, with the closed rules of 4.3 applied for closed statuses. */
export function planCreateIssue(args: CreateIssueArgs): CreateNote {
	const { config, title, status, order, today } = args;
	const trimmed = title.trim();
	if (trimmed === '') throw new Error('An issue needs a title');

	const frontmatter: Frontmatter = {
		title: trimmed,
		project: config.key,
		type: 'task',
		status,
		priority: 'medium',
		labels: [],
		created: today,
		order,
	};
	if (isClosed(config, status)) frontmatter.closed = today;
	if (isReleasedStatus(config, status)) {
		if (args.release === undefined) throw new Error(`Creating an issue in ${status} requires a release`);
		frontmatter.release = wikilink(args.release);
	}

	return {
		kind: 'create',
		path: issuePath(config, nextNumber(args.issues, config.key)),
		frontmatter,
		body: args.templateBody ?? '',
	};
}

/** Spec 2.3 / 4.3: a release note, planned or released. */
export function planCreateRelease(config: ProjectConfig, version: string, status: 'planned' | 'released', today: string): CreateNote {
	const v = version.trim();
	if (v === '') throw new Error('A release needs a version');
	const frontmatter: Frontmatter = { type: 'release', project: config.key, version: v, status };
	if (status === 'released') frontmatter.released = today;
	return { kind: 'create', path: releasePath(config, v), frontmatter, body: '' };
}
