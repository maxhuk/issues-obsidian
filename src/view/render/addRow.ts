import { setIcon } from 'obsidian';
import type { Actions, AddPosition } from '../types';

/** The permanent "Add issue" row at a section's bottom, or the input it (and the header button) turns into. */
export function renderAddRow(parent: HTMLElement, status: string, position: AddPosition, actions: Actions): void {
	const open = actions.addInput;
	if (open && open.status === status && open.position === position) {
		renderInput(parent, status, position, open.draft, actions);
		return;
	}
	if (position === 'top') return;

	const row = parent.createDiv({ cls: 'issues-add-row' });
	const icon = row.createSpan({ cls: 'issues-add-icon' });
	setIcon(icon, 'lucide-plus');
	row.createSpan({ text: 'Add issue' });
	row.addEventListener('click', () => actions.openAddInput(status, 'bottom'));
}

function renderInput(parent: HTMLElement, status: string, position: AddPosition, draft: string, actions: Actions): void {
	const wrap = parent.createDiv({ cls: 'issues-add-input' });
	const input = wrap.createEl('input', { type: 'text', placeholder: 'Issue title', value: draft });
	input.addEventListener('input', () => actions.setAddDraft(input.value));
	input.addEventListener('keydown', (evt) => {
		if (evt.key === 'Escape') {
			evt.preventDefault();
			actions.closeAddInput();
			return;
		}
		if (evt.key !== 'Enter') return;
		evt.preventDefault();
		const title = input.value.trim();
		if (title === '') return;
		const keepOpen = evt.shiftKey;
		void actions.createIssue(status, title, position).then(() => {
			if (keepOpen) {
				actions.setAddDraft('');
				actions.openAddInput(status, position);
			} else {
				actions.closeAddInput();
			}
		});
	});
	window.setTimeout(() => {
		input.focus();
		input.setSelectionRange(input.value.length, input.value.length);
	}, 0);
}
