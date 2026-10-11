import { describe, expect, it } from 'vitest';
import { planShip, shippableIssues } from './ship';
import { config, issue, release } from './fixtures';

const TODAY = '2026-10-10';
const c = config();
const issues = [issue({ number: 1, status: 'merged', order: 'a1' }), issue({ number: 2, status: 'doing' }), issue({ number: 3, status: 'merged' })];

describe('planShip', () => {
	it('marks the release note first, then moves every merged issue, keeping order', () => {
		const plans = planShip(c, issues, release({ version: '1.5.0' }), TODAY);
		expect(plans[0]).toEqual({ kind: 'patch', path: 'Projects/Breathe/Releases/BRE-1.5.0.md', set: { status: 'released', released: TODAY }, clear: [] });
		expect(plans.slice(1).map((p) => p.path)).toEqual([issues[0]!.path, issues[2]!.path]);
		expect(plans[1]).toMatchObject({ set: { status: 'released', closed: TODAY, release: '[[BRE-1.5.0]]' }, clear: [] });
	});

	it('creates the release note as released when given only a version', () => {
		const plans = planShip(c, issues, { version: '1.6.0' }, TODAY);
		expect(plans[0]).toMatchObject({ kind: 'create', path: 'Projects/Breathe/Releases/BRE-1.6.0.md', frontmatter: { status: 'released', released: TODAY } });
		expect(plans[1]).toMatchObject({ set: { release: '[[BRE-1.6.0]]' } });
	});

	it('is re-runnable: already released issues are not shipped again', () => {
		const after = [issue({ number: 1, status: 'released', release: 'BRE-1.5.0', closed: TODAY }), issue({ number: 3, status: 'merged' })];
		expect(shippableIssues(after, c).map((i) => i.number)).toEqual([3]);
	});

	it('refuses when releases are off', () => {
		expect(() => planShip(config({ releases: false }), issues, { version: '1.0.0' }, TODAY)).toThrow(/does not track releases/);
	});
});
