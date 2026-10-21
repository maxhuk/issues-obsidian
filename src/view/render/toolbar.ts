import { setIcon } from 'obsidian';
import type { Actions, ViewModel } from '../types';
import { shippableIssues } from '../../model/ship';

export function renderToolbar(parent: HTMLElement, model: ViewModel, actions: Actions): void {
	if (model.missingProjectNote) {
		const banner = parent.createDiv({ cls: 'issues-banner' });
		banner.createSpan({
			text: `The project note ${model.missingProjectNote.notePath} is missing. The list runs on default settings until it is recreated.`,
		});
		const button = banner.createEl('button', { cls: 'mod-cta', text: 'Recreate project note' });
		button.addEventListener('click', () => {
			button.disabled = true;
			void actions.recoverProjectNote().finally(() => {
				button.disabled = false;
			});
		});
	}
	const bar = parent.createDiv({ cls: 'issues-toolbar' });

	const search = bar.createDiv({ cls: 'issues-search' });
	const icon = search.createSpan({ cls: 'issues-search-icon' });
	setIcon(icon, 'lucide-search');
	const input = search.createEl('input', { type: 'search', placeholder: 'Filter', value: actions.filterText });
	input.addEventListener('input', () => actions.setFilter(input.value));

	if (model.config.releases && shippableIssues(model.issues, model.config).length > 0) {
		const ship = bar.createEl('button', { cls: 'issues-ship mod-cta', text: 'Ship' });
		ship.addEventListener('click', () => {
			ship.disabled = true;
			void actions.ship().finally(() => {
				ship.disabled = false;
			});
		});
	}
}
