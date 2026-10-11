import type { Issue, Patch, ProjectConfig } from '../types';
import { isClosed, isReleasedStatus } from './project';

export function wikilink(basename: string): string {
	return `[[${basename}]]`;
}

/** Spec 4.3: moving into `status_released` needs a release when releases are on. */
export function requiresRelease(config: ProjectConfig, to: string): boolean {
	return isReleasedStatus(config, to);
}

export interface StatusChangeOptions {
	/** Basename of the release note. Required when `requiresRelease(config, to)`. */
	release?: string;
	/** A new `order` key, `null` to clear it, or omit to leave it untouched. */
	order?: string | null;
}

/** Spec 4.3: one patch for one issue. Throws when a required release is missing. */
export function statusChangePatch(
	issue: Issue,
	to: string,
	config: ProjectConfig,
	today: string,
	options: StatusChangeOptions = {},
): Patch {
	const set: Patch['set'] = { status: to };
	const clear: string[] = [];

	const fromClosed = isClosed(config, issue.status);
	const toClosed = isClosed(config, to);
	if (!fromClosed && toClosed) set.closed = today;
	if (fromClosed && !toClosed) clear.push('closed');

	if (requiresRelease(config, to)) {
		if (options.release === undefined) throw new Error(`Moving ${issue.key} to ${to} requires a release`);
		set.release = wikilink(options.release);
	} else if (isReleasedStatus(config, issue.status)) {
		clear.push('release');
	}

	if (options.order === null) clear.push('order');
	else if (typeof options.order === 'string') set.order = options.order;

	return { kind: 'patch', path: issue.path, set, clear };
}

/** Spec 4.4: changing the release of an already released issue. `null` moves it to the "No release" group. */
export function releaseChangePatch(issue: Issue, release: string | null): Patch {
	return release === null
		? { kind: 'patch', path: issue.path, set: {}, clear: ['release'] }
		: { kind: 'patch', path: issue.path, set: { release: wikilink(release) }, clear: [] };
}
