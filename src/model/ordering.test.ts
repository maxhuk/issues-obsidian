import { describe, expect, it } from 'vitest';
import { keyBetween, placeAt, placeAtBottom, placeAtTop, sortIssues } from './ordering';
import { issue } from './fixtures';

describe('sortIssues', () => {
	it('puts keyed rows first by order, then unkeyed by created then number', () => {
		const rows = [
			issue({ number: 1, order: null, created: '2026-02-01' }),
			issue({ number: 2, order: 'a2' }),
			issue({ number: 3, order: null, created: '2026-01-01' }),
			issue({ number: 4, order: 'a1' }),
			issue({ number: 5, order: null, created: '2026-01-01' }),
		];
		expect(sortIssues(rows).map((i) => i.number)).toEqual([4, 2, 3, 5, 1]);
	});
});

describe('sortIssues with keys generated above a0', () => {
	it('keeps a row dropped at the top above a0 (code-unit order, not locale order)', () => {
		const a = issue({ number: 1, order: 'a0' });
		const moved = issue({ number: 2, order: 'a1' });
		const { order } = placeAtTop([a], moved);
		expect(order).toBe('Zz');
		expect(sortIssues([a, { ...moved, order }]).map((i) => i.number)).toEqual([2, 1]);
	});
});

describe('placeAt', () => {
	const a = issue({ number: 1, order: 'a0' });
	const b = issue({ number: 2, order: 'a1' });
	const c = issue({ number: 3, order: 'a2' });
	const moved = issue({ number: 9, order: 'zz' });

	it('generates a key strictly between neighbours and touches no other note', () => {
		const { order, patches } = placeAt([a, b, c, moved], moved, 1);
		expect(patches).toEqual([]);
		expect(order > 'a0' && order < 'a1').toBe(true);
	});

	it('top and bottom helpers key outside the extremes', () => {
		expect(placeAtTop([a, b, c], moved).order < 'a0').toBe(true);
		expect(placeAtBottom([a, b, c], moved).order > 'a2').toBe(true);
	});

	it('clamps an out-of-range index', () => {
		expect(placeAt([a, b, c], moved, 99).order > 'a2').toBe(true);
		expect(placeAt([a, b, c], moved, -4).order < 'a0').toBe(true);
	});

	it('keys every unkeyed row of the section when a neighbour is unkeyed', () => {
		const u1 = issue({ number: 10, order: null, created: '2026-01-01' });
		const u2 = issue({ number: 11, order: null, created: '2026-01-02' });
		const { order, patches } = placeAt([a, u1, u2], moved, 2);
		expect(patches.map((p) => p.path)).toEqual([u1.path, u2.path]);
		const k1 = patches[0]!.set.order as string;
		const k2 = patches[1]!.set.order as string;
		expect(k1 > 'a0' && k2 > k1).toBe(true);
		expect(order > k1 && order < k2).toBe(true);
	});

	it('does not key unkeyed rows when the drop is among keyed rows', () => {
		const u1 = issue({ number: 10, order: null });
		const { patches } = placeAt([a, b, u1], moved, 1);
		expect(patches).toEqual([]);
	});

	it('works on an empty section', () => {
		const { order, patches } = placeAt([], moved, 0);
		expect(patches).toEqual([]);
		expect(order).toBe(keyBetween(null, null));
	});
});
