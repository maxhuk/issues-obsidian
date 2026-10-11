import { describe, expect, it } from 'vitest';
import type { Plan } from '../types';
import { groupIdFor, orderForNew, planDrop, planMoveToStatus, planSendTo, targetRows } from './moves';
import { buildSections } from './sections';
import { config, issue, release } from './fixtures';

const TODAY = '2026-10-10';
const c = config();
const issues = [
	issue({ number: 1, status: 'next', order: 'a0' }),
	issue({ number: 2, status: 'next', order: 'a1' }),
	issue({ number: 3, status: 'next', order: 'a2' }),
	issue({ number: 4, status: 'backlog', order: 'a3' }),
	issue({ number: 5, status: 'merged', order: 'a4' }),
	issue({ number: 6, status: 'released', release: 'BRE-1.0.0', closed: '2026-03-01', order: 'a5' }),
	issue({ number: 7, status: 'released', release: 'BRE-1.0.0', closed: '2026-03-01', order: 'a6' }),
];
const releases = [release({ version: '1.0.0', status: 'released', released: '2026-03-01' }), release({ version: '1.1.0' })];
const sections = buildSections({ issues, releases, config: c, today: TODAY });
const path = (n: number) => issues[n - 1]!.path;
const setOf = (plan: Plan | undefined): Record<string, string> => (plan?.kind === 'patch' ? (plan.set as Record<string, string>) : {});

describe('targetRows', () => {
	it('returns section rows, or group rows for a grouped section', () => {
		expect(targetRows(sections, 'next', null).map((i) => i.number)).toEqual([1, 2, 3]);
		expect(targetRows(sections, 'released', groupIdFor('BRE-1.0.0')).map((i) => i.number)).toEqual([6, 7]);
		expect(targetRows(sections, 'released', groupIdFor('BRE-1.1.0'))).toEqual([]);
		expect(targetRows(sections, 'nope', null)).toEqual([]);
	});
});

describe('planDrop', () => {
	it('reorders within a section with a single order patch', () => {
		const plans = planDrop({ config: c, sections, issue: issues[2]!, status: 'next', groupId: null, index: 0, today: TODAY });
		expect(plans).toHaveLength(1);
		expect(plans[0]).toMatchObject({ kind: 'patch', path: path(3), clear: [] });
		expect(setOf(plans[0]).order! < 'a0').toBe(true);
	});

	it('moves across sections with status rules and a placed order', () => {
		const plans = planDrop({ config: c, sections, issue: issues[3]!, status: 'next', groupId: null, index: 1, today: TODAY });
		expect(plans).toHaveLength(1);
		const set = setOf(plans[0]);
		expect(set.status).toBe('next');
		expect(set.order! > 'a0' && set.order! < 'a1').toBe(true);
	});

	it('requires a release when landing in the released section and writes it', () => {
		expect(() => planDrop({ config: c, sections, issue: issues[4]!, status: 'released', groupId: null, index: 0, today: TODAY })).toThrow(/requires a release/);
		const plans = planDrop({ config: c, sections, issue: issues[4]!, status: 'released', groupId: groupIdFor('BRE-1.1.0'), index: 0, today: TODAY, release: 'BRE-1.1.0' });
		expect(plans[0]).toMatchObject({ set: { status: 'released', release: '[[BRE-1.1.0]]', closed: TODAY } });
	});

	it('changes only the release when dragged between groups of the released section', () => {
		const plans = planDrop({ config: c, sections, issue: issues[5]!, status: 'released', groupId: groupIdFor('BRE-1.1.0'), index: 0, today: TODAY, release: 'BRE-1.1.0' });
		expect(plans).toHaveLength(1);
		const set = setOf(plans[0]);
		expect(set.release).toBe('[[BRE-1.1.0]]');
		expect(set).not.toHaveProperty('status');
	});
});

describe('planSendTo / planMoveToStatus', () => {
	it('sends to the extremes of the issue’s own container', () => {
		const top = setOf(planSendTo(c, sections, issues[2]!, 'top', TODAY)[0]);
		const bottom = setOf(planSendTo(c, sections, issues[0]!, 'bottom', TODAY)[0]);
		expect(top.order! < 'a0').toBe(true);
		expect(bottom.order! > 'a2').toBe(true);
		const inGroup = setOf(planSendTo(c, sections, issues[6]!, 'top', TODAY)[0]);
		expect(inGroup.order! < 'a5').toBe(true);
	});

	it('moves to the top of another section', () => {
		const plan = setOf(planMoveToStatus(c, sections, issues[3]!, 'next', TODAY)[0]);
		expect(plan.status).toBe('next');
		expect(plan.order! < 'a0').toBe(true);
	});
});

describe('orderForNew', () => {
	it('keys outside the extremes, and from nothing on an empty section', () => {
		expect(orderForNew(sections, 'next', 'top') < 'a0').toBe(true);
		expect(orderForNew(sections, 'next', 'bottom') > 'a2').toBe(true);
		expect(typeof orderForNew(sections, 'inbox', 'bottom')).toBe('string');
	});
});
