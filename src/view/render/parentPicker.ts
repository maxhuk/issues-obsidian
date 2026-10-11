import { SuggestModal, type App } from 'obsidian';
import type { Issue } from '../../types';

type Choice = { kind: 'issue'; issue: Issue } | { kind: 'clear' };

class ParentSuggestModal extends SuggestModal<Choice> {
	private settled = false;

	constructor(
		app: App,
		private readonly candidates: Issue[],
		private readonly hasParent: boolean,
		private readonly resolve: (choice: Choice | null) => void,
	) {
		super(app);
		this.setPlaceholder('Parent issue: key or title');
	}

	getSuggestions(query: string): Choice[] {
		const q = query.trim().toLowerCase();
		const issues = this.candidates
			.filter((i) => i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
			.slice(0, 50)
			.map<Choice>((issue) => ({ kind: 'issue', issue }));
		return this.hasParent ? [{ kind: 'clear' }, ...issues] : issues;
	}

	renderSuggestion(value: Choice, el: HTMLElement): void {
		if (value.kind === 'clear') {
			el.createDiv({ cls: 'issues-suggest-new', text: 'No parent' });
			return;
		}
		el.createDiv({ text: value.issue.title });
		el.createDiv({ cls: 'issues-suggest-meta', text: `${value.issue.key} · ${value.issue.status}` });
	}

	onChooseSuggestion(item: Choice): void {
		this.settled = true;
		this.resolve(item);
	}

	onClose(): void {
		if (!this.settled) this.resolve(null);
	}
}

/** Resolves the chosen parent's basename, `null` to clear, or `undefined` when dismissed. */
export async function pickParent(app: App, issue: Issue, issues: Issue[]): Promise<string | null | undefined> {
	const candidates = issues.filter((i) => i.path !== issue.path);
	const choice = await new Promise<Choice | null>((resolve) =>
		new ParentSuggestModal(app, candidates, issue.parent !== null, resolve).open(),
	);
	if (choice === null) return undefined;
	return choice.kind === 'clear' ? null : choice.issue.key;
}
