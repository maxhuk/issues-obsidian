import { describe, expect, it } from 'vitest';
import { nextNumber, planCreateIssue, planCreateRelease, releaseBasename } from './create';
import { config, issue } from './fixtures';

const TODAY = '2026-10-10';
const c = config();

describe('nextNumber', () => {
	it('is max + 1 over the project key only, and 1 for an empty project', () => {
		const issues = [issue({ number: 3 }), issue({ number: 12 }), { ...issue({ number: 99 }), key: 'YOG-99' }, { ...issue(), key: 'odd' }];
		expect(nextNumber(issues, 'BRE')).toBe(13);
		expect(nextNumber([], 'BRE')).toBe(1);
	});
});

describe('planCreateIssue', () => {
	it('writes exactly the spec 3.4 keys into the issues folder', () => {
		const plan = planCreateIssue({ config: c, issues: [issue({ number: 4 })], title: '  Fix drift ', status: 'backlog', order: 'a0', today: TODAY });
		expect(plan).toEqual({
			kind: 'create',
			path: 'Projects/Breathe/Issues/BRE-5.md',
			frontmatter: { title: 'Fix drift', project: 'BRE', type: 'task', status: 'backlog', priority: 'medium', labels: [], created: TODAY, order: 'a0' },
			body: '',
		});
	});

	it('copies the template body', () => {
		expect(planCreateIssue({ config: c, issues: [], title: 'x', status: 'inbox', order: 'a0', today: TODAY, templateBody: '## Context\n' }).body).toBe('## Context\n');
	});

	it('applies closed and release rules for closed statuses', () => {
		const canceled = planCreateIssue({ config: c, issues: [], title: 'x', status: 'canceled', order: 'a0', today: TODAY });
		expect(canceled.frontmatter.closed).toBe(TODAY);
		expect(() => planCreateIssue({ config: c, issues: [], title: 'x', status: 'released', order: 'a0', today: TODAY })).toThrow(/requires a release/);
		const released = planCreateIssue({ config: c, issues: [], title: 'x', status: 'released', order: 'a0', today: TODAY, release: 'BRE-1.0.0' });
		expect(released.frontmatter).toMatchObject({ closed: TODAY, release: '[[BRE-1.0.0]]' });
	});

	it('rejects an empty title', () => {
		expect(() => planCreateIssue({ config: c, issues: [], title: '  ', status: 'inbox', order: 'a0', today: TODAY })).toThrow(/title/);
	});
});

describe('planCreateRelease', () => {
	it('names the note key-version and stamps released when shipping directly', () => {
		expect(releaseBasename('BRE', '1.5.0')).toBe('BRE-1.5.0');
		expect(planCreateRelease(c, ' 1.5.0 ', 'planned', TODAY)).toEqual({
			kind: 'create',
			path: 'Projects/Breathe/Releases/BRE-1.5.0.md',
			frontmatter: { type: 'release', project: 'BRE', version: '1.5.0', status: 'planned' },
			body: '',
		});
		expect(planCreateRelease(c, '1.5.0', 'released', TODAY).frontmatter.released).toBe(TODAY);
		expect(() => planCreateRelease(c, '', 'planned', TODAY)).toThrow(/version/);
	});
});
