import type { Issue, Plan, ProjectConfig, Release } from '../types';
import { planCreateRelease } from './create';
import { statusChangePatch } from './status';

export function shippableIssues(issues: Issue[], config: ProjectConfig): Issue[] {
	return issues.filter((i) => i.status === config.statusShipFrom);
}

/**
 * Spec 4.5: the release note first, then every issue in `status_ship_from`.
 * `release` is an existing release note, or a version string for a release created as part of shipping.
 */
export function planShip(config: ProjectConfig, issues: Issue[], release: Release | { version: string }, today: string): Plan[] {
	if (!config.releases) throw new Error(`${config.name} does not track releases`);

	const plans: Plan[] = [];
	let basename: string;
	if ('basename' in release) {
		basename = release.basename;
		plans.push({ kind: 'patch', path: release.path, set: { status: 'released', released: today }, clear: [] });
	} else {
		const created = planCreateRelease(config, release.version, 'released', today);
		basename = created.path.split('/').at(-1)!.replace(/\.md$/, '');
		plans.push(created);
	}

	for (const issue of shippableIssues(issues, config)) {
		plans.push(statusChangePatch(issue, config.statusReleased, config, today, { release: basename }));
	}
	return plans;
}
