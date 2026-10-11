import type { Issue } from '../types';
import { sortIssues } from './ordering';

/** Spec 4.5: tasks first, then bugs under a `Fixes` line that is omitted when there are no bugs. */
export function changelogText(issues: Issue[]): string {
	const sorted = sortIssues(issues);
	const lines = sorted.filter((i) => i.type !== 'bug').map((i) => `- ${i.title}`);
	const fixes = sorted.filter((i) => i.type === 'bug').map((i) => `- ${i.title}`);
	if (fixes.length > 0) lines.push('Fixes', ...fixes);
	return lines.join('\n');
}
