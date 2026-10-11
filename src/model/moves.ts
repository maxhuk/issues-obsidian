import type { Issue, Patch, Plan, ProjectConfig, Section } from '../types';
import { placeAt } from './ordering';
import { isReleasedStatus } from './project';
import { statusChangePatch, wikilink } from './status';

export const NONE_GROUP = 'none';

export function groupIdFor(release: string | null): string {
	return release === null ? NONE_GROUP : `release:${release}`;
}

/** Rows of the container a drop lands in: a release group when the section is grouped, else the section. */
export function targetRows(sections: Section[], status: string, groupId: string | null): Issue[] {
	const section = sections.find((s) => s.status === status);
	if (!section) return [];
	if (!section.grouped || groupId === null) return section.issues;
	return section.groups.find((g) => g.id === groupId)?.issues ?? [];
}

export interface DropArgs {
	config: ProjectConfig;
	sections: Section[];
	issue: Issue;
	status: string;
	/** Group within a grouped section, or `null` for the section itself. */
	groupId: string | null;
	/** Position among the target rows with the moved issue excluded. */
	index: number;
	today: string;
	/** Release basename; required when landing in `status_released`. */
	release?: string;
}

/** Spec 4.1: order for the moved issue, status rules when the section changed, release when the group changed. */
export function planDrop(args: DropArgs): Plan[] {
	const { config, sections, issue, status, groupId, index, today, release } = args;
	const placement = placeAt(targetRows(sections, status, groupId), issue, index);
	const plans: Plan[] = [...placement.patches];

	if (issue.status !== status) {
		plans.push(statusChangePatch(issue, status, config, today, { release, order: placement.order }));
		return plans;
	}

	const patch: Patch = { kind: 'patch', path: issue.path, set: { order: placement.order }, clear: [] };
	if (isReleasedStatus(config, status) && release !== undefined && release !== issue.release) {
		patch.set.release = wikilink(release);
	}
	plans.push(patch);
	return plans;
}

/** Spec 4.2: Send to top / bottom within the issue's own container. */
export function planSendTo(config: ProjectConfig, sections: Section[], issue: Issue, where: 'top' | 'bottom', today: string): Plan[] {
	const groupId = isReleasedStatus(config, issue.status) ? groupIdFor(issue.release) : null;
	const rows = targetRows(sections, issue.status, groupId);
	return planDrop({ config, sections, issue, status: issue.status, groupId, index: where === 'top' ? 0 : rows.length, today });
}

/** Spec 4.2: Move to section places the issue at the top of the target. */
export function planMoveToStatus(config: ProjectConfig, sections: Section[], issue: Issue, status: string, today: string, release?: string): Plan[] {
	const groupId = release !== undefined ? groupIdFor(release) : null;
	return planDrop({ config, sections, issue, status, groupId, index: 0, today, release });
}

/** Spec 3.4: the `order` for a new issue added at the top or bottom of a section. */
export function orderForNew(sections: Section[], status: string, position: 'top' | 'bottom'): string {
	const rows = targetRows(sections, status, null);
	const probe: Issue = {
		path: '',
		key: '',
		number: 0,
		title: '',
		project: '',
		type: 'task',
		status,
		priority: 'medium',
		labels: [],
		parent: null,
		release: null,
		order: null,
		created: null,
		closed: null,
	};
	return placeAt(rows, probe, position === 'top' ? 0 : rows.length).order;
}
