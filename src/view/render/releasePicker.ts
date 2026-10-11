import { Modal, Setting, SuggestModal, type App } from 'obsidian';
import type { Release } from '../../types';
import { compareVersionsDesc } from '../../model/sections';

export type ReleaseChoice = { kind: 'existing'; release: Release } | { kind: 'new'; version: string };

type Suggestion = { kind: 'existing'; release: Release } | { kind: 'new' };

class ReleaseSuggestModal extends SuggestModal<Suggestion> {
	private settled = false;

	constructor(
		app: App,
		private readonly releases: Release[],
		private readonly resolve: (choice: Suggestion | null) => void,
	) {
		super(app);
		this.setPlaceholder('Pick a release');
	}

	getSuggestions(query: string): Suggestion[] {
		const q = query.trim().toLowerCase();
		const existing = this.releases
			.filter((r) => r.version.toLowerCase().includes(q))
			.sort((a, b) => compareVersionsDesc(a.version, b.version))
			.map<Suggestion>((release) => ({ kind: 'existing', release }));
		return [...existing, { kind: 'new' }];
	}

	renderSuggestion(value: Suggestion, el: HTMLElement): void {
		if (value.kind === 'new') {
			el.createDiv({ cls: 'issues-suggest-new', text: 'New release…' });
			return;
		}
		el.createDiv({ text: value.release.version });
		el.createDiv({ cls: 'issues-suggest-meta', text: value.release.status === 'planned' ? 'planned' : (value.release.released ?? 'released') });
	}

	onChooseSuggestion(item: Suggestion): void {
		this.settled = true;
		this.resolve(item);
	}

	onClose(): void {
		if (!this.settled) this.resolve(null);
	}
}

class VersionPromptModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly resolve: (version: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText('New release');
		let version = '';
		const submit = () => {
			if (version.trim() === '') return;
			this.settled = true;
			this.resolve(version.trim());
			this.close();
		};
		new Setting(this.contentEl).setName('Version').addText((text) => {
			text.setPlaceholder('1.5.0').onChange((value) => {
				version = value;
			});
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});
		new Setting(this.contentEl).addButton((button) => button.setButtonText('Create').setCta().onClick(submit));
	}

	onClose(): void {
		if (!this.settled) this.resolve(null);
	}
}

function promptVersion(app: App): Promise<string | null> {
	return new Promise((resolve) => new VersionPromptModal(app, resolve).open());
}

/** Spec 4.3 / 4.5: planned releases newest first, plus "New release…". Resolves null when dismissed. */
export async function pickRelease(app: App, releases: Release[]): Promise<ReleaseChoice | null> {
	const planned = releases.filter((r) => r.status === 'planned');
	const picked = await new Promise<Suggestion | null>((resolve) => new ReleaseSuggestModal(app, planned, resolve).open());
	if (picked === null) return null;
	if (picked.kind === 'existing') return picked;
	const version = await promptVersion(app);
	return version === null ? null : { kind: 'new', version };
}
