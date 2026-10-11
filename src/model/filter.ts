import type { Issue, Section } from '../types';

/** Spec 3.3: title, key or labels contain the text, case-insensitively. */
export function matchesFilter(issue: Issue, text: string): boolean {
	const needle = text.trim().toLowerCase();
	if (needle === '') return true;
	return (
		issue.title.toLowerCase().includes(needle) ||
		issue.key.toLowerCase().includes(needle) ||
		issue.labels.some((l) => l.toLowerCase().includes(needle))
	);
}

/** Narrows visible rows; headers, hidden counts and group structure are kept. */
export function filterSections(sections: Section[], text: string): Section[] {
	if (text.trim() === '') return sections;
	return sections.map((section) => ({
		...section,
		issues: section.issues.filter((i) => matchesFilter(i, text)),
		groups: section.groups.map((g) => ({ ...g, issues: g.issues.filter((i) => matchesFilter(i, text)) })),
	}));
}
