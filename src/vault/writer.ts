import type { App } from 'obsidian';
import type { CreateFile, CreateNote, Patch, Plan } from '../types';

function parentFolder(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
	if (folder === '' || app.vault.getFolderByPath(folder)) return;
	let current = '';
	for (const part of folder.split('/')) {
		current = current === '' ? part : `${current}/${part}`;
		if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
	}
}

/** Applies plans in order. Frontmatter is only ever touched through Obsidian's own serializer. */
export class PlanWriter {
	constructor(private readonly app: App) {}

	async apply(plans: Plan[]): Promise<void> {
		for (const plan of plans) {
			if (plan.kind === 'patch') await this.patch(plan);
			else if (plan.kind === 'create') await this.create(plan);
			else await this.file(plan);
		}
	}

	private async patch(plan: Patch): Promise<void> {
		const file = this.app.vault.getFileByPath(plan.path);
		if (!file) throw new Error(`${plan.path} does not exist`);
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			for (const [key, value] of Object.entries(plan.set)) frontmatter[key] = value;
			for (const key of plan.clear) delete frontmatter[key];
		});
	}

	private async file(plan: CreateFile): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(plan.path)) throw new Error(`${plan.path} already exists`);
		await ensureFolder(this.app, parentFolder(plan.path));
		await this.app.vault.create(plan.path, plan.content);
	}

	private async create(plan: CreateNote): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(plan.path)) throw new Error(`${plan.path} already exists`);
		await ensureFolder(this.app, parentFolder(plan.path));
		const file = await this.app.vault.create(plan.path, plan.body);
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			Object.assign(frontmatter, plan.frontmatter);
		});
	}
}
