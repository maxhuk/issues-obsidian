import { describe, expect, it } from 'vitest';
import { releaseChangePatch, requiresRelease, statusChangePatch } from './status';
import { config, issue } from './fixtures';

const TODAY = '2026-10-10';
const c = config();

describe('statusChangePatch', () => {
	it('open → closed sets closed', () => {
		const i = issue({ status: 'doing' });
		const p = statusChangePatch(i, 'canceled', c, TODAY);
		expect(p).toEqual({ kind: 'patch', path: i.path, set: { status: 'canceled', closed: TODAY }, clear: [] });
	});

	it('closed → closed keeps closed', () => {
		const p = statusChangePatch(issue({ status: 'canceled', closed: '2026-01-01' }), 'released', c, TODAY, { release: 'BRE-1.0.0' });
		expect(p.set).toEqual({ status: 'released', release: '[[BRE-1.0.0]]' });
		expect(p.clear).toEqual([]);
	});

	it('closed → open clears closed, and leaving released clears release', () => {
		const p = statusChangePatch(issue({ status: 'released', closed: '2026-01-01', release: 'BRE-1.0.0' }), 'backlog', c, TODAY);
		expect(p.set).toEqual({ status: 'backlog' });
		expect(p.clear).toEqual(['closed', 'release']);
	});

	it('open → open touches only status', () => {
		expect(statusChangePatch(issue({ status: 'backlog' }), 'next', c, TODAY)).toMatchObject({ set: { status: 'next' }, clear: [] });
	});

	it('requires a release when entering the released status and writes it as a wikilink', () => {
		expect(requiresRelease(c, 'released')).toBe(true);
		expect(requiresRelease(c, 'merged')).toBe(false);
		expect(() => statusChangePatch(issue({ status: 'merged' }), 'released', c, TODAY)).toThrow(/requires a release/);
		const p = statusChangePatch(issue({ status: 'merged' }), 'released', c, TODAY, { release: 'BRE-1.5.0' });
		expect(p.set).toEqual({ status: 'released', closed: TODAY, release: '[[BRE-1.5.0]]' });
	});

	it('ignores release rules when releases are off', () => {
		const off = config({ releases: false, statuses: ['backlog', 'released'], statusesClosed: ['released'] });
		expect(requiresRelease(off, 'released')).toBe(false);
		const p = statusChangePatch(issue({ status: 'backlog' }), 'released', off, TODAY);
		expect(p.set).toEqual({ status: 'released', closed: TODAY });
	});

	it('sets, clears or leaves order as asked', () => {
		expect(statusChangePatch(issue(), 'next', c, TODAY, { order: 'a5' }).set.order).toBe('a5');
		expect(statusChangePatch(issue(), 'next', c, TODAY, { order: null }).clear).toEqual(['order']);
		expect(statusChangePatch(issue(), 'next', c, TODAY).set).not.toHaveProperty('order');
	});
});

describe('releaseChangePatch', () => {
	it('sets or clears the release link', () => {
		expect(releaseChangePatch(issue(), 'BRE-2.0.0')).toMatchObject({ set: { release: '[[BRE-2.0.0]]' }, clear: [] });
		expect(releaseChangePatch(issue(), null)).toMatchObject({ set: {}, clear: ['release'] });
	});
});
