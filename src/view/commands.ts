import { Notice, type App } from 'obsidian';
import type { Issue, Plan, ReleaseGroup } from '../types';
import { changelogText } from '../model/changelog';
import { planCreateIssue, planCreateRelease } from '../model/create';
import { groupIdFor, orderForNew, planDrop, planMoveToStatus, planSendTo } from '../model/moves';
import { planShip } from '../model/ship';
import { releaseChangePatch, requiresRelease, statusChangePatch, wikilink } from '../model/status';
import { readTemplateBody } from '../vault/template';
import { PlanWriter } from '../vault/writer';
import { confirm } from './render/confirmModal';
import { pickParent } from './render/parentPicker';
import { pickRelease } from './render/releasePicker';
import type { AddPosition, DropTarget, ViewModel } from './types';
import type { OverrideStore } from './overrides';
import { todayIso } from './util';

export interface CommandHost {
	app: App;
	model(): ViewModel | null;
	overrides: OverrideStore;
	/** Rebuild the model from the current data and redraw everything. */
	refresh(): void;
	/** Redraw only the detail panel, e.g. after a dismissed picker left a control stale. */
	refreshPanel(): void;
}

function notify(error: unknown): void {
	console.error('Issues: write failed', error);
	new Notice(`Issues: ${error instanceof Error ? error.message : String(error)}`);
}

/** Every write the view performs. Plans come from the model; this class only chooses releases and applies. */
export class Commands {
	private readonly writer: PlanWriter;

	constructor(private readonly host: CommandHost) {
		this.writer = new PlanWriter(host.app);
	}

	private async apply(plans: Plan[], optimistic = true): Promise<boolean> {
		if (optimistic) {
			for (const plan of plans) if (plan.kind === 'patch') this.host.overrides.remember(plan.path, plan.set, plan.clear);
			this.host.refresh();
		}
		try {
			await this.writer.apply(plans);
			return true;
		} catch (error) {
			this.host.overrides.clear();
			notify(error);
			this.host.refresh();
			return false;
		}
	}

	/** Spec 4.3: a planned release from the picker, or a planned note created for a new version. */
	private async chooseRelease(): Promise<{ basename: string; plans: Plan[] } | null> {
		const model = this.host.model();
		if (!model) return null;
		const choice = await pickRelease(this.host.app, model.releases.filter((r) => r.project === model.config.key));
		if (choice === null) return null;
		if (choice.kind === 'existing') return { basename: choice.release.basename, plans: [] };
		const created = planCreateRelease(model.config, choice.version, 'planned', todayIso());
		return { basename: created.path.split('/').at(-1)!.replace(/\.md$/, ''), plans: [created] };
	}

	async createIssue(status: string, title: string, position: AddPosition): Promise<void> {
		const model = this.host.model();
		if (!model) return;
		const plans: Plan[] = [];
		let release: string | undefined;
		if (requiresRelease(model.config, status)) {
			const chosen = await this.chooseRelease();
			if (!chosen) return;
			release = chosen.basename;
			plans.push(...chosen.plans);
		}
		try {
			const templateBody = await readTemplateBody(this.host.app, model.config.issueTemplate);
			const order = orderForNew(model.sections, status, position);
			plans.push(planCreateIssue({ config: model.config, issues: model.issues, title, status, order, today: todayIso(), templateBody, release }));
		} catch (error) {
			notify(error);
			return;
		}
		await this.apply(plans, false);
	}

	async sendTo(issue: Issue, where: 'top' | 'bottom'): Promise<void> {
		const model = this.host.model();
		if (!model) return;
		await this.apply(planSendTo(model.config, model.sections, issue, where, todayIso()));
	}

	async moveToStatus(issue: Issue, status: string): Promise<void> {
		const model = this.host.model();
		if (!model) return;
		const plans: Plan[] = [];
		let release: string | undefined;
		if (requiresRelease(model.config, status)) {
			const chosen = await this.chooseRelease();
			if (!chosen) return;
			release = chosen.basename;
			plans.push(...chosen.plans);
		}
		plans.push(...planMoveToStatus(model.config, model.sections, issue, status, todayIso(), release));
		await this.apply(plans);
	}

	async drop(issue: Issue, target: DropTarget): Promise<void> {
		const model = this.host.model();
		if (!model) return;
		const plans: Plan[] = [];
		let release: string | undefined;
		let groupId = target.groupId;
		if (requiresRelease(model.config, target.status)) {
			if (groupId !== null && groupId.startsWith('release:')) {
				release = groupId.slice('release:'.length);
			} else {
				const chosen = await this.chooseRelease();
				if (!chosen) return;
				release = chosen.basename;
				plans.push(...chosen.plans);
				groupId = groupIdFor(release);
			}
		}
		plans.push(
			...planDrop({ config: model.config, sections: model.sections, issue, status: target.status, groupId, index: target.index, today: todayIso(), release }),
		);
		await this.apply(plans);
	}

	async changeStatus(issue: Issue, status: string): Promise<void> {
		const model = this.host.model();
		if (!model || status === issue.status) return;
		const plans: Plan[] = [];
		let release: string | undefined;
		if (requiresRelease(model.config, status)) {
			const chosen = await this.chooseRelease();
			if (!chosen) {
				this.host.refreshPanel();
				return;
			}
			release = chosen.basename;
			plans.push(...chosen.plans);
		}
		plans.push(statusChangePatch(issue, status, model.config, todayIso(), { release }));
		await this.apply(plans);
	}

	async patchIssue(issue: Issue, set: Record<string, unknown>, clear: string[] = []): Promise<void> {
		await this.apply([{ kind: 'patch', path: issue.path, set, clear }]);
	}

	async setRelease(issue: Issue, release: string | null): Promise<void> {
		await this.apply([releaseChangePatch(issue, release)]);
	}

	async pickParent(issue: Issue): Promise<void> {
		const model = this.host.model();
		if (!model) return;
		const choice = await pickParent(this.host.app, issue, model.issues);
		if (choice === undefined) return;
		await (choice === null ? this.patchIssue(issue, {}, ['parent']) : this.patchIssue(issue, { parent: wikilink(choice) }));
	}

	async ship(): Promise<void> {
		const model = this.host.model();
		if (!model) return;
		const choice = await pickRelease(this.host.app, model.releases.filter((r) => r.project === model.config.key));
		if (choice === null) return;
		const release = choice.kind === 'existing' ? choice.release : { version: choice.version };
		const version = choice.kind === 'existing' ? choice.release.version : choice.version;
		const plans = planShip(model.config, model.issues, release, todayIso());
		if (await this.apply(plans)) new Notice(`Shipped ${version}: ${plans.length - 1} issues released`);
	}

	/** Spec 4.2: moves the note to the trash Obsidian is configured for, after confirmation. */
	async deleteIssue(issue: Issue): Promise<boolean> {
		const ok = await confirm(this.host.app, `Delete ${issue.key}?`, `"${issue.title}" goes to the trash. Its attachments stay where they are.`, 'Delete');
		if (!ok) return false;
		const file = this.host.app.vault.getFileByPath(issue.path);
		if (!file) return false;
		try {
			await this.host.app.fileManager.trashFile(file);
			return true;
		} catch (error) {
			notify(error);
			return false;
		}
	}

	async copyChangelog(group: ReleaseGroup): Promise<void> {
		await navigator.clipboard.writeText(changelogText(group.issues));
		new Notice(`Changelog for ${group.label} copied`);
	}
}
