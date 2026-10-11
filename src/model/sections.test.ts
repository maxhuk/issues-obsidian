import { describe, expect, it } from 'vitest';
import { buildReleaseGroups, buildSections, compareVersionsDesc, daysBetween, isHiddenByAge } from './sections';
import { config, issue, release } from './fixtures';

const TODAY = '2026-10-10';

describe('daysBetween / isHiddenByAge', () => {
	it('counts whole days and tolerates bad dates', () => {
		expect(daysBetween('2026-10-01', TODAY)).toBe(9);
		expect(daysBetween('nonsense', TODAY)).toBe(0);
	});

	it('hides strictly after the threshold, treats a missing closed date as today, and 0 hides all', () => {
		const c = config({ hideClosedAfterDays: 14 });
		expect(isHiddenByAge(issue({ closed: '2026-09-26' }), c, TODAY)).toBe(false);
		expect(isHiddenByAge(issue({ closed: '2026-09-25' }), c, TODAY)).toBe(true);
		expect(isHiddenByAge(issue({ closed: null }), c, TODAY)).toBe(false);
		expect(isHiddenByAge(issue({ closed: null }), config({ hideClosedAfterDays: 0 }), TODAY)).toBe(true);
	});
});

describe('compareVersionsDesc', () => {
	it('sorts numerically per segment, newest first', () => {
		const sorted = ['1.9.2', '1.10.0', '2.0.0', '1.10.0-beta'].sort(compareVersionsDesc);
		expect(sorted).toEqual(['2.0.0', '1.10.0-beta', '1.10.0', '1.9.2']);
	});
});

describe('buildSections', () => {
	const c = config();
	const releases = [
		release({ version: '1.0.0', status: 'released', released: '2026-03-01' }),
		release({ version: '1.1.0', status: 'released', released: '2026-06-01' }),
		release({ version: '1.2.0', status: 'planned' }),
		release({ version: '2.0.0', status: 'planned' }),
	];
	const issues = [
		issue({ number: 1, status: 'inbox' }),
		issue({ number: 2, status: 'doing', order: 'a1' }),
		issue({ number: 3, status: 'doing', order: 'a0' }),
		issue({ number: 4, status: 'canceled', closed: '2026-10-09' }),
		issue({ number: 5, status: 'canceled', closed: '2026-01-01' }),
		issue({ number: 6, status: 'released', release: 'BRE-1.0.0', closed: '2026-03-01' }),
		issue({ number: 7, status: 'released', release: 'BRE-1.1.0', closed: '2026-06-01' }),
		issue({ number: 8, status: 'released', release: 'BRE-9.9.9', closed: '2026-06-01' }),
		issue({ number: 9, status: 'released', release: null }),
		issue({ number: 10, status: 'wontfix' }),
		issue({ number: 11, status: 'blocked' }),
	];
	const sections = buildSections({ issues, releases, config: c, today: TODAY });

	it('emits open statuses from last to first, then closed ones in flow order, then unknown statuses', () => {
		expect(sections.map((s) => s.status)).toEqual(['merged', 'pr', 'doing', 'next', 'backlog', 'inbox', 'released', 'canceled', 'blocked', 'wontfix']);
		expect(sections.find((s) => s.status === 'blocked')).toMatchObject({ known: false, closed: false, grouped: false, issues: [issues[10]] });
	});

	it('sorts rows within a section by order', () => {
		expect(sections.find((s) => s.status === 'doing')!.issues.map((i) => i.number)).toEqual([3, 2]);
	});

	it('hides aged closed issues and counts them, unless revealed', () => {
		const canceled = sections.find((s) => s.status === 'canceled')!;
		expect(canceled.issues.map((i) => i.number)).toEqual([4]);
		expect(canceled.hiddenCount).toBe(1);
		const revealed = buildSections({ issues, releases, config: c, today: TODAY, revealed: new Set(['canceled']) });
		expect(revealed.find((s) => s.status === 'canceled')!.issues).toHaveLength(2);
	});

	it('groups the released section and never hides it by age', () => {
		const released = sections.find((s) => s.status === 'released')!;
		expect(released.grouped).toBe(true);
		expect(released.hiddenCount).toBe(0);
		expect(released.groups.map((g) => [g.kind, g.label, g.issues.map((i) => i.number)])).toEqual([
			['planned', '2.0.0', []],
			['planned', '1.2.0', []],
			['released', '1.1.0', [7]],
			['released', '1.0.0', [6]],
			['dangling', 'BRE-9.9.9', [8]],
			['none', 'No release', [9]],
		]);
		expect(released.groups.map((g) => g.defaultCollapsed)).toEqual([true, true, false, true, true, true]);
	});

	it('does not group when releases are off', () => {
		const off = config({ releases: false, statuses: ['backlog', 'done'], statusesClosed: ['done'] });
		const s = buildSections({ issues: [issue({ status: 'done', closed: '2026-10-01' })], releases: [], config: off, today: TODAY });
		expect(s.find((x) => x.status === 'done')).toMatchObject({ grouped: false, groups: [], issues: [expect.anything()] });
	});
});

describe('buildReleaseGroups', () => {
	it('ignores releases of other projects and omits empty released groups', () => {
		const groups = buildReleaseGroups(
			[],
			[release({ version: '1.0.0', status: 'released', released: '2026-01-01' }), { ...release({ version: '3.0.0' }), project: 'YOG' }],
			'BRE',
		);
		expect(groups).toEqual([]);
	});
});
