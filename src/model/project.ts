import type { NoteRecord, ProjectConfig, ProjectParse } from '../types';

const DEFAULTS = {
	withReleases: {
		statuses: ['inbox', 'backlog', 'next', 'doing', 'pr', 'merged', 'released', 'canceled'],
		statusesClosed: ['released', 'canceled'],
	},
	withoutReleases: {
		statuses: ['inbox', 'backlog', 'next', 'doing', 'done', 'canceled'],
		statusesClosed: ['done', 'canceled'],
	},
	statusReleased: 'released',
	statusShipFrom: 'merged',
	hideClosedAfterDays: 14,
	issuesFolder: 'Issues',
	releasesFolder: 'Releases',
};

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function list(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const items = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim());
	return items.length > 0 ? items : null;
}

function folderOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

function joinFolder(base: string, relative: string): string {
	const rel = relative.replace(/^\/+|\/+$/g, '');
	if (base === '') return rel;
	return rel === '' ? base : `${base}/${rel}`;
}

/** Spec 2.1: parse and validate the project note. */
export function parseProject(note: NoteRecord): ProjectParse {
	const fm = note.frontmatter;
	if (fm.type !== 'project') return { ok: false, error: 'type must be "project"' };
	const key = text(fm.project);
	if (key === null) return { ok: false, error: 'project (the key) is required' };

	const releases = fm.releases === undefined ? true : fm.releases === true;
	const defaults = releases ? DEFAULTS.withReleases : DEFAULTS.withoutReleases;
	const statuses = list(fm.statuses) ?? defaults.statuses;
	const statusesClosed = list(fm.statuses_closed) ?? defaults.statusesClosed;
	const statusReleased = text(fm.status_released) ?? DEFAULTS.statusReleased;
	const statusShipFrom = text(fm.status_ship_from) ?? DEFAULTS.statusShipFrom;
	const hideClosedAfterDays =
		typeof fm.hide_closed_after_days === 'number' && fm.hide_closed_after_days >= 0
			? fm.hide_closed_after_days
			: DEFAULTS.hideClosedAfterDays;

	for (const s of statusesClosed) {
		if (!statuses.includes(s)) return { ok: false, error: `statuses_closed contains "${s}", which is not in statuses` };
	}
	const statusMeanings: Record<string, string> = {};
	for (const entry of list(fm.status_meanings) ?? []) {
		const colon = entry.indexOf(':');
		const status = colon === -1 ? '' : entry.slice(0, colon).trim();
		const meaning = colon === -1 ? '' : entry.slice(colon + 1).trim();
		if (status === '' || meaning === '') return { ok: false, error: `status_meanings entry "${entry}" is not "status: meaning"` };
		if (!statuses.includes(status)) return { ok: false, error: `status_meanings mentions "${status}", which is not in statuses` };
		statusMeanings[status] = meaning;
	}
	if (releases) {
		if (!statuses.includes(statusReleased)) return { ok: false, error: `status_released "${statusReleased}" is not in statuses` };
		if (!statuses.includes(statusShipFrom)) return { ok: false, error: `status_ship_from "${statusShipFrom}" is not in statuses` };
		if (!statusesClosed.includes(statusReleased)) {
			return { ok: false, error: `status_released "${statusReleased}" is not in statuses_closed` };
		}
	}

	const folder = folderOf(note.path);
	const config: ProjectConfig = {
		path: note.path,
		folder,
		name: note.basename,
		key,
		releases,
		statuses,
		statusesClosed,
		statusMeanings,
		statusReleased,
		statusShipFrom,
		hideClosedAfterDays,
		issuesFolder: joinFolder(folder, text(fm.issues_folder) ?? DEFAULTS.issuesFolder),
		releasesFolder: joinFolder(folder, text(fm.releases_folder) ?? DEFAULTS.releasesFolder),
		issueTemplate: text(fm.issue_template),
	};
	return { ok: true, config };
}

export function isClosed(config: ProjectConfig, status: string): boolean {
	return config.statusesClosed.includes(status);
}

export function isReleasedStatus(config: ProjectConfig, status: string): boolean {
	return config.releases && status === config.statusReleased;
}
