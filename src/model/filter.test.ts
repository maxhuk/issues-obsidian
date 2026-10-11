import { describe, expect, it } from 'vitest';
import { filterSections, matchesFilter } from './filter';
import { config, issue } from './fixtures';
import { buildSections } from './sections';

describe('matchesFilter', () => {
	const i = issue({ number: 42, title: 'Fix Timer drift', labels: ['iOS', 'audio'] });
	it('matches title, key and labels case-insensitively; empty matches all', () => {
		expect(matchesFilter(i, 'timer')).toBe(true);
		expect(matchesFilter(i, 'bre-42')).toBe(true);
		expect(matchesFilter(i, 'AUDIO')).toBe(true);
		expect(matchesFilter(i, '  ')).toBe(true);
		expect(matchesFilter(i, 'android')).toBe(false);
	});
});

describe('filterSections', () => {
	const sections = buildSections({
		issues: [issue({ number: 1, title: 'alpha' }), issue({ number: 2, title: 'beta' }), issue({ number: 3, title: 'alpha two', status: 'released' })],
		releases: [],
		config: config(),
		today: '2026-10-10',
	});

	it('keeps every section and narrows rows and group rows', () => {
		const filtered = filterSections(sections, 'alpha');
		expect(filtered).toHaveLength(sections.length);
		expect(filtered.find((s) => s.status === 'backlog')!.issues.map((i) => i.number)).toEqual([1]);
		expect(filtered.find((s) => s.status === 'released')!.groups[0]!.issues.map((i) => i.number)).toEqual([3]);
	});

	it('returns the same array for an empty filter', () => {
		expect(filterSections(sections, '')).toBe(sections);
	});
});
