import { setIcon, setTooltip } from 'obsidian';
import type { Issue } from '../../types';
import type { Actions } from '../types';

export function renderRow(parent: HTMLElement, issue: Issue, actions: Actions): HTMLElement {
	const row = parent.createDiv({ cls: 'issues-row' });
	row.dataset.path = issue.path;
	if (issue.path === actions.selectedPath) row.addClass('is-selected');

	const handle = row.createSpan({ cls: 'issues-row-handle' });
	setIcon(handle, 'lucide-grip-vertical');

	const type = row.createSpan({ cls: `issues-row-type is-${issue.type === 'bug' ? 'bug' : 'task'}` });
	setIcon(type, issue.type === 'bug' ? 'lucide-bug' : 'lucide-square-check');
	setTooltip(type, issue.type);

	row.createSpan({ cls: 'issues-row-key', text: issue.key });
	row.createSpan({ cls: 'issues-row-title', text: issue.title });

	const chips = row.createSpan({ cls: 'issues-row-chips' });
	if (issue.priority !== 'medium') {
		const priority = chips.createSpan({ cls: `issues-row-priority is-${issue.priority}` });
		setIcon(priority, issue.priority === 'high' ? 'lucide-chevron-up' : 'lucide-chevron-down');
		setTooltip(priority, `${issue.priority} priority`);
	}
	for (const label of issue.labels) chips.createSpan({ cls: 'issues-chip issues-chip-label', text: label });
	if (issue.parent !== null) {
		const parentChip = chips.createSpan({ cls: 'issues-chip issues-chip-parent', text: issue.parent });
		parentChip.dataset.parent = issue.parent;
	}

	row.addEventListener('click', (evt) => {
		const target = evt.target as HTMLElement;
		const parentChip = target.closest<HTMLElement>('.issues-chip-parent');
		if (parentChip?.dataset.parent) {
			evt.stopPropagation();
			row.dispatchEvent(new CustomEvent('issues:open-parent', { bubbles: true, detail: parentChip.dataset.parent }));
			return;
		}
		actions.openIssue(issue);
	});
	row.addEventListener('contextmenu', (evt) => {
		evt.preventDefault();
		actions.showRowMenu(issue, evt.clientX, evt.clientY);
	});
	return row;
}
