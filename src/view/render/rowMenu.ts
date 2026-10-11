import { Menu } from 'obsidian';
import type { Issue, ProjectConfig } from '../../types';
import type { Actions } from '../types';

/** Spec 4.2: Send to top, Send to bottom, one "Move to …" entry per status, then Delete. */
export function showRowMenu(issue: Issue, config: ProjectConfig, actions: Actions, x: number, y: number): void {
	const menu = new Menu();
	menu.addItem((item) =>
		item
			.setTitle('Send to top')
			.setIcon('lucide-arrow-up-to-line')
			.onClick(() => void actions.sendTo(issue, 'top')),
	);
	menu.addItem((item) =>
		item
			.setTitle('Send to bottom')
			.setIcon('lucide-arrow-down-to-line')
			.onClick(() => void actions.sendTo(issue, 'bottom')),
	);
	menu.addSeparator();
	for (const status of config.statuses) {
		menu.addItem((item) => {
			item.setTitle(`Move to ${status}`).setIcon('lucide-corner-down-right');
			if (status === issue.status) item.setDisabled(true);
			else item.onClick(() => void actions.moveToStatus(issue, status));
		});
	}
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle('Delete')
			.setIcon('lucide-trash-2')
			.setWarning(true)
			.onClick(() => void actions.deleteIssue(issue)),
	);
	menu.showAtPosition({ x, y });
}
