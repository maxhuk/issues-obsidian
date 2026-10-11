import { Modal, Notice, Setting, type App } from 'obsidian';
import { planCreateProject, suggestKey, validateProjectArgs } from '../model/createProject';
import { PlanWriter } from '../vault/writer';

const DEFAULT_PARENT = 'Projects';

/** Spec 3.5: name, key and parent folder; creates the project and opens its note. */
export class NewProjectModal extends Modal {
	private name = '';
	private key = '';
	private keyEdited = false;
	private parentFolder = DEFAULT_PARENT;

	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText('New project');
		let keyInput: HTMLInputElement | null = null;

		new Setting(this.contentEl).setName('Name').setDesc('Folder and note name, e.g. Breathe').addText((text) => {
			text.setPlaceholder('Breathe').onChange((value) => {
				this.name = value;
				if (!this.keyEdited && keyInput) {
					this.key = suggestKey(value);
					keyInput.value = this.key;
				}
			});
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') void this.submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl).setName('Key').setDesc('Uppercase prefix for issue keys; suggested from the name').addText((text) => {
			keyInput = text.inputEl;
			text.setPlaceholder('BRE').onChange((value) => {
				this.key = value.toUpperCase();
				this.keyEdited = value !== '';
				text.inputEl.value = this.key;
			});
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') void this.submit();
			});
		});

		new Setting(this.contentEl).setName('Parent folder').setDesc('Where the project folder is created').addText((text) => {
			text.setValue(DEFAULT_PARENT).onChange((value) => {
				this.parentFolder = value;
			});
		});

		new Setting(this.contentEl).addButton((button) => button.setButtonText('Create').setCta().onClick(() => void this.submit()));
	}

	private async submit(): Promise<void> {
		const args = { parentFolder: this.parentFolder, name: this.name, key: this.key };
		const error = validateProjectArgs(args);
		if (error) {
			new Notice(error);
			return;
		}
		const plan = planCreateProject(args);
		if (this.app.vault.getAbstractFileByPath(plan.folder)) {
			new Notice(`${plan.folder} already exists`);
			return;
		}
		try {
			await new PlanWriter(this.app).apply(plan.plans);
		} catch (err) {
			new Notice(`Issues: ${err instanceof Error ? err.message : String(err)}`);
			return;
		}
		this.close();
		const note = this.app.vault.getFileByPath(plan.notePath);
		if (note) await this.app.workspace.getLeaf(false).openFile(note);
	}
}
