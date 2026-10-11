import { describe, expect, it } from 'vitest';
import { linkBasename, parseKey, partition } from './partition';
import { record } from './fixtures';

describe('linkBasename', () => {
	it('strips wikilink syntax, aliases, headings, paths and extensions', () => {
		expect(linkBasename('[[BRE-100]]')).toBe('BRE-100');
		expect(linkBasename('[[BRE-100|the parent]]')).toBe('BRE-100');
		expect(linkBasename('[[BRE-100#Notes]]')).toBe('BRE-100');
		expect(linkBasename('[[Projects/Breathe/Issues/BRE-100.md]]')).toBe('BRE-100');
		expect(linkBasename('BRE-100')).toBe('BRE-100');
		expect(linkBasename('')).toBeNull();
		expect(linkBasename(undefined)).toBeNull();
	});
});

describe('parseKey', () => {
	it('accepts KEY-number and rejects anything else', () => {
		expect(parseKey('BRE-12')).toEqual({ key: 'BRE-12', number: 12 });
		expect(parseKey('A1-3')).toEqual({ key: 'A1-3', number: 3 });
		expect(parseKey('bre-12')).toBeNull();
		expect(parseKey('BRE-1.5.0')).toBeNull();
		expect(parseKey('Breathe')).toBeNull();
	});
});

describe('partition', () => {
	const notes = [
		record('Projects/Breathe/Breathe.md', { type: 'project', project: 'BRE' }),
		record('Projects/Breathe/Releases/BRE-1.0.0.md', { type: 'release', project: 'BRE', version: '1.0.0', status: 'released', released: '2026-03-01' }),
		record('Projects/Breathe/Releases/BRE-1.1.0.md', { type: 'release', project: 'BRE', version: '1.1.0' }),
		record('Projects/Breathe/Issues/BRE-7.md', {
			title: 'Fix drift',
			project: 'BRE',
			type: 'bug',
			status: 'doing',
			priority: 'high',
			labels: ['ios'],
			parent: '[[BRE-3]]',
			release: '[[BRE-1.0.0]]',
			order: 'a0',
			created: '2026-01-02',
		}),
		record('Projects/Breathe/Issues/BRE-8.md', { project: 'BRE', status: 'inbox' }),
		record('Projects/Breathe/Issues/odd.md', { project: 'BRE', type: 'spike', status: 'backlog', priority: 'urgent', labels: 'one' }),
	];
	const p = partition(notes);

	it('splits by type', () => {
		expect(p.projects.map((n) => n.basename)).toEqual(['Breathe']);
		expect(p.releases.map((r) => r.version)).toEqual(['1.0.0', '1.1.0']);
		expect(p.issues.map((i) => i.key)).toEqual(['BRE-7', 'BRE-8', 'odd']);
	});

	it('normalises a full issue', () => {
		const i = p.issues[0]!;
		expect(i).toMatchObject({
			key: 'BRE-7',
			number: 7,
			title: 'Fix drift',
			type: 'bug',
			status: 'doing',
			priority: 'high',
			labels: ['ios'],
			parent: 'BRE-3',
			release: 'BRE-1.0.0',
			order: 'a0',
			created: '2026-01-02',
			closed: null,
		});
	});

	it('fills defaults for a sparse issue', () => {
		expect(p.issues[1]).toMatchObject({ title: 'BRE-8', type: 'task', priority: 'medium', labels: [], order: null, created: null });
	});

	it('keeps unknown values visible rather than dropping them', () => {
		expect(p.issues[2]).toMatchObject({ key: 'odd', number: 0, type: 'spike', priority: 'medium', labels: ['one'] });
	});

	it('normalises releases', () => {
		expect(p.releases[0]).toMatchObject({ basename: 'BRE-1.0.0', status: 'released', released: '2026-03-01' });
		expect(p.releases[1]).toMatchObject({ basename: 'BRE-1.1.0', status: 'planned', released: null });
	});
});
