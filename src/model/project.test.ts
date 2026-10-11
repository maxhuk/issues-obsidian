import { describe, expect, it } from 'vitest';
import { parseProject } from './project';
import { record } from './fixtures';

const PATH = 'Projects/Breathe/Breathe.md';

function ok(fm: Record<string, unknown>) {
	const result = parseProject(record(PATH, fm));
	if (!result.ok) throw new Error(result.error);
	return result.config;
}

describe('parseProject', () => {
	it('applies the release defaults and resolves folders relative to the note', () => {
		const c = ok({ type: 'project', project: 'BRE' });
		expect(c.key).toBe('BRE');
		expect(c.name).toBe('Breathe');
		expect(c.releases).toBe(true);
		expect(c.statuses).toEqual(['inbox', 'backlog', 'next', 'doing', 'pr', 'merged', 'released', 'canceled']);
		expect(c.statusesClosed).toEqual(['released', 'canceled']);
		expect(c.issuesFolder).toBe('Projects/Breathe/Issues');
		expect(c.releasesFolder).toBe('Projects/Breathe/Releases');
		expect(c.hideClosedAfterDays).toBe(14);
		expect(c.issueTemplate).toBeNull();
	});

	it('switches defaults when releases is false', () => {
		const c = ok({ type: 'project', project: 'BRE', releases: false });
		expect(c.statuses).toEqual(['inbox', 'backlog', 'next', 'doing', 'done', 'canceled']);
		expect(c.statusesClosed).toEqual(['done', 'canceled']);
	});

	it('honours overrides', () => {
		const c = ok({
			type: 'project',
			project: 'BRE',
			statuses: ['todo', 'doing', 'shipped', 'dropped'],
			statuses_closed: ['shipped', 'dropped'],
			status_released: 'shipped',
			status_ship_from: 'doing',
			hide_closed_after_days: 0,
			issues_folder: 'Work/',
			issue_template: 'Templates/Issue.md',
		});
		expect(c.statusReleased).toBe('shipped');
		expect(c.statusShipFrom).toBe('doing');
		expect(c.hideClosedAfterDays).toBe(0);
		expect(c.issuesFolder).toBe('Projects/Breathe/Work');
		expect(c.issueTemplate).toBe('Templates/Issue.md');
	});

	it('rejects a note that is not a project or has no key', () => {
		expect(parseProject(record(PATH, { type: 'release', project: 'BRE' })).ok).toBe(false);
		expect(parseProject(record(PATH, { type: 'project' })).ok).toBe(false);
		expect(parseProject(record(PATH, { type: 'project', project: '  ' })).ok).toBe(false);
	});

	it('validates status membership', () => {
		const bad = (fm: Record<string, unknown>) => {
			const r = parseProject(record(PATH, { type: 'project', project: 'BRE', ...fm }));
			return r.ok ? null : r.error;
		};
		expect(bad({ statuses_closed: ['gone'] })).toMatch(/statuses_closed/);
		expect(bad({ statuses: ['a', 'b'], statuses_closed: ['b'] })).toMatch(/status_released/);
		expect(bad({ statuses: ['a', 'released'], statuses_closed: ['released'] })).toMatch(/status_ship_from/);
		expect(bad({ statuses_closed: ['canceled'] })).toMatch(/not in statuses_closed/);
	});

	it('skips release validation when releases is off', () => {
		const c = ok({ type: 'project', project: 'BRE', releases: false, statuses: ['a', 'b'], statuses_closed: ['b'] });
		expect(c.statuses).toEqual(['a', 'b']);
	});

	it('works for a project note at the vault root', () => {
		const c = ok({ type: 'project', project: 'BRE' });
		const root = parseProject(record('Breathe.md', { type: 'project', project: 'BRE' }));
		expect(root.ok && root.config.issuesFolder).toBe('Issues');
		expect(c.folder).toBe('Projects/Breathe');
	});
});
