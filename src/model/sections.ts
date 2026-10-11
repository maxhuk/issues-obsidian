import type { Issue, ProjectConfig, Release, ReleaseGroup, Section } from '../types';
import { sortIssues } from './ordering';
import { isClosed, isReleasedStatus } from './project';

export interface SectionsInput {
	issues: Issue[];
	releases: Release[];
	config: ProjectConfig;
	/** `YYYY-MM-DD` */
	today: string;
	/** Statuses whose age-hidden rows are shown for this session. */
	revealed?: Set<string>;
}

const DAY_MS = 86_400_000;

export function daysBetween(from: string, to: string): number {
	const a = Date.parse(from);
	const b = Date.parse(to);
	if (Number.isNaN(a) || Number.isNaN(b)) return 0;
	return Math.floor((b - a) / DAY_MS);
}

/** Spec 2.1: hidden when `today − closed > hide_closed_after_days`; `0` hides every closed issue. */
export function isHiddenByAge(issue: Issue, config: ProjectConfig, today: string): boolean {
	if (config.hideClosedAfterDays === 0) return true;
	return daysBetween(issue.closed ?? today, today) > config.hideClosedAfterDays;
}

/** Numeric-aware descending comparison for versions such as `1.10.0` vs `1.9.2`. */
export function compareVersionsDesc(a: string, b: string): number {
	const pa = a.split(/[^0-9a-zA-Z]+/);
	const pb = b.split(/[^0-9a-zA-Z]+/);
	const n = Math.max(pa.length, pb.length);
	for (let i = 0; i < n; i++) {
		const x = pa[i] ?? '';
		const y = pb[i] ?? '';
		if (x === y) continue;
		const nx = Number(x);
		const ny = Number(y);
		if (!Number.isNaN(nx) && !Number.isNaN(ny)) return ny - nx;
		return y.localeCompare(x);
	}
	return 0;
}

/** Spec 3.1, released section: planned (version desc), released (date desc), dangling, none. */
export function buildReleaseGroups(issues: Issue[], releases: Release[], key: string): ReleaseGroup[] {
	const projectReleases = releases.filter((r) => r.project === key);
	const byBasename = new Map(projectReleases.map((r) => [r.basename, r]));
	const issuesByRelease = new Map<string | null, Issue[]>();
	for (const issue of sortIssues(issues)) {
		const list = issuesByRelease.get(issue.release) ?? [];
		list.push(issue);
		issuesByRelease.set(issue.release, list);
	}

	const planned = projectReleases
		.filter((r) => r.status === 'planned')
		.sort((a, b) => compareVersionsDesc(a.version, b.version))
		.map<ReleaseGroup>((r) => ({
			id: `release:${r.basename}`,
			kind: 'planned',
			release: r,
			label: r.version,
			date: null,
			issues: issuesByRelease.get(r.basename) ?? [],
			defaultCollapsed: true,
		}));

	const released = projectReleases
		.filter((r) => r.status === 'released' && (issuesByRelease.get(r.basename)?.length ?? 0) > 0)
		.sort((a, b) => (b.released ?? '').localeCompare(a.released ?? '') || compareVersionsDesc(a.version, b.version))
		.map<ReleaseGroup>((r, index) => ({
			id: `release:${r.basename}`,
			kind: 'released',
			release: r,
			label: r.version,
			date: r.released,
			issues: issuesByRelease.get(r.basename) ?? [],
			defaultCollapsed: index !== 0,
		}));

	const dangling = [...issuesByRelease.keys()]
		.filter((name): name is string => name !== null && !byBasename.has(name))
		.sort()
		.map<ReleaseGroup>((name) => ({
			id: `release:${name}`,
			kind: 'dangling',
			release: null,
			label: name,
			date: null,
			issues: issuesByRelease.get(name) ?? [],
			defaultCollapsed: true,
		}));

	const none = issuesByRelease.get(null) ?? [];
	const noneGroup: ReleaseGroup[] =
		none.length > 0
			? [{ id: 'none', kind: 'none', release: null, label: 'No release', date: null, issues: none, defaultCollapsed: true }]
			: [];

	return [...planned, ...released, ...dangling, ...noneGroup];
}

/** Spec 3.1: open statuses from last to first, then closed statuses in flow order, then unknown statuses. */
export function buildSections(input: SectionsInput): Section[] {
	const { issues, releases, config, today } = input;
	const revealed = input.revealed ?? new Set<string>();
	const byStatus = new Map<string, Issue[]>();
	for (const issue of issues) {
		const list = byStatus.get(issue.status) ?? [];
		list.push(issue);
		byStatus.set(issue.status, list);
	}

	const unknown = [...byStatus.keys()].filter((s) => !config.statuses.includes(s)).sort();
	const open = config.statuses.filter((s) => !isClosed(config, s)).reverse();
	const closedStatuses = config.statuses.filter((s) => isClosed(config, s));
	const statuses = [...open, ...closedStatuses].map((s) => ({ status: s, known: true })).concat(unknown.map((s) => ({ status: s, known: false })));

	return statuses.map(({ status, known }) => {
		const all = sortIssues(byStatus.get(status) ?? []);
		const closed = known && isClosed(config, status);
		const grouped = known && isReleasedStatus(config, status);

		if (grouped) {
			return { status, known, closed, grouped, issues: all, hiddenCount: 0, groups: buildReleaseGroups(all, releases, config.key) };
		}

		const hideByAge = closed && !revealed.has(status);
		const visible = hideByAge ? all.filter((i) => !isHiddenByAge(i, config, today)) : all;
		return { status, known, closed, grouped, issues: visible, hiddenCount: all.length - visible.length, groups: [] };
	});
}
