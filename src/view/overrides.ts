import type { Issue } from '../types';
import { linkBasename } from '../model/partition';

const TTL_MS = 5000;

interface Override {
	values: Partial<Issue>;
	until: number;
}

/**
 * Optimistic values shown until Bases delivers the written data, or until they expire.
 * An override is dropped as soon as the vault reports the same values.
 */
export class OverrideStore {
	private readonly byPath = new Map<string, Override>();

	remember(path: string, set: Record<string, unknown>, clear: string[]): void {
		const values: Partial<Issue> = { ...(this.byPath.get(path)?.values ?? {}) };
		for (const [key, value] of Object.entries(set)) {
			if (key === 'release') values.release = linkBasename(value);
			else if (key === 'parent') values.parent = linkBasename(value);
			else if (key === 'labels') values.labels = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
			else if (key === 'priority') values.priority = value === 'high' || value === 'low' ? value : 'medium';
			else if (typeof value === 'string' && ['status', 'order', 'closed', 'title', 'type'].includes(key)) {
				(values as Record<string, string>)[key] = value;
			}
		}
		for (const key of clear) {
			if (key === 'order' || key === 'release' || key === 'parent' || key === 'closed') values[key] = null;
		}
		this.byPath.set(path, { values, until: Date.now() + TTL_MS });
	}

	resolve(issue: Issue): Issue {
		const override = this.byPath.get(issue.path);
		if (!override) return issue;
		const settled = Object.entries(override.values).every(
			([key, value]) => JSON.stringify(issue[key as keyof Issue]) === JSON.stringify(value),
		);
		if (settled || override.until < Date.now()) {
			this.byPath.delete(issue.path);
			return issue;
		}
		return { ...issue, ...override.values };
	}

	clear(): void {
		this.byPath.clear();
	}
}
