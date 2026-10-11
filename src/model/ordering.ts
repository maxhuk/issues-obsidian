import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { Issue, Patch } from '../types';

export function keyBetween(before: string | null, after: string | null): string {
	return generateKeyBetween(before, after);
}

function compareCreated(a: Issue, b: Issue): number {
	const byDate = (a.created ?? '').localeCompare(b.created ?? '');
	return byDate !== 0 ? byDate : a.number - b.number;
}

/** Fractional-index keys order by code unit, never by locale: `Zz` sorts before `a0`. */
export function compareOrderKeys(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Spec 3.2: keyed rows by `order` ascending, then unkeyed rows by `created` ascending. */
export function sortIssues(issues: Issue[]): Issue[] {
	const keyed = issues.filter((i) => i.order !== null).sort((a, b) => compareOrderKeys(a.order!, b.order!));
	const unkeyed = issues.filter((i) => i.order === null).sort(compareCreated);
	return [...keyed, ...unkeyed];
}

export interface Placement {
	order: string;
	/** Patches that key previously unkeyed rows. Applied before the moved issue's own patch. */
	patches: Patch[];
}

/**
 * Compute the `order` for `moved` so that it sits at `index` within `section`
 * (the section's rows in display order, `moved` excluded).
 * When a neighbour has no key, every unkeyed row of the section is keyed first (spec 4.1).
 */
export function placeAt(section: Issue[], moved: Issue, index: number): Placement {
	const rows = sortIssues(section.filter((i) => i.path !== moved.path));
	const clamped = Math.max(0, Math.min(index, rows.length));
	const before = rows[clamped - 1] ?? null;
	const after = rows[clamped] ?? null;

	const patches: Patch[] = [];
	const orders = new Map(rows.map((i) => [i.path, i.order]));

	const needsKeying = (before !== null && before.order === null) || (after !== null && after.order === null);
	if (needsKeying) {
		const unkeyed = rows.filter((i) => i.order === null);
		const lastKeyed = rows.filter((i) => i.order !== null).at(-1)?.order ?? null;
		const keys = generateNKeysBetween(lastKeyed, null, unkeyed.length);
		unkeyed.forEach((issue, n) => {
			const key = keys[n]!;
			orders.set(issue.path, key);
			patches.push({ kind: 'patch', path: issue.path, set: { order: key }, clear: [] });
		});
	}

	const order = keyBetween(
		before ? (orders.get(before.path) ?? null) : null,
		after ? (orders.get(after.path) ?? null) : null,
	);
	return { order, patches };
}

export function placeAtTop(section: Issue[], moved: Issue): Placement {
	return placeAt(section, moved, 0);
}

export function placeAtBottom(section: Issue[], moved: Issue): Placement {
	return placeAt(section, moved, section.length);
}
