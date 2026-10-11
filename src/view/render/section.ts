import { setIcon, setTooltip } from 'obsidian';
import type { Issue, ReleaseGroup, Section } from '../../types';
import type { Actions } from '../types';
import { renderAddRow } from './addRow';
import { renderRow } from './row';

export function sectionId(status: string): string {
	return `status:${status}`;
}

export function renderSection(parent: HTMLElement, section: Section, actions: Actions): void {
	const el = parent.createDiv({ cls: 'issues-section' });
	el.dataset.status = section.status;
	if (!section.known) el.addClass('is-unknown');
	const collapsed = actions.isCollapsed(sectionId(section.status));
	el.toggleClass('is-collapsed', collapsed);

	const count = section.grouped ? section.groups.reduce((n, g) => n + g.issues.length, 0) : section.issues.length;
	const header = renderHeader(el, {
		label: section.status === '' ? '(no status)' : section.status,
		count,
		collapsed,
		onToggle: () => actions.toggleCollapsed(sectionId(section.status)),
	});
	if (section.hiddenCount > 0) {
		const revealed = actions.isRevealed(section.status);
		const hidden = header.createEl('button', {
			cls: 'issues-hidden-toggle',
			text: revealed ? 'Hide older' : `${section.hiddenCount} hidden`,
		});
		hidden.addEventListener('click', (evt) => {
			evt.stopPropagation();
			actions.toggleRevealed(section.status);
		});
	}
	const add = header.createEl('button', { cls: 'issues-icon-button issues-add-top' });
	setIcon(add, 'lucide-plus');
	setTooltip(add, 'Add issue at top');
	add.addEventListener('click', (evt) => {
		evt.stopPropagation();
		actions.openAddInput(section.status, 'top');
	});

	if (collapsed) return;

	const body = el.createDiv({ cls: 'issues-section-body' });
	renderAddRow(body, section.status, 'top', actions);
	if (section.grouped) {
		for (const group of section.groups) renderGroup(body, group, actions);
	} else {
		renderRows(body, section.issues, actions);
	}
	renderAddRow(body, section.status, 'bottom', actions);
}

function renderGroup(parent: HTMLElement, group: ReleaseGroup, actions: Actions): void {
	const el = parent.createDiv({ cls: `issues-group is-${group.kind}` });
	el.dataset.groupId = group.id;
	const stored = actions.isCollapsed(group.id);
	const collapsed = stored || (group.defaultCollapsed && !actions.isCollapsed(`${group.id}:open`));
	el.toggleClass('is-collapsed', collapsed);

	const header = renderHeader(el, {
		label: group.label,
		count: group.issues.length,
		collapsed,
		meta: group.kind === 'planned' ? 'planned' : group.date,
		onToggle: () => actions.toggleCollapsed(group.defaultCollapsed ? `${group.id}:open` : group.id),
	});
	if (group.kind === 'released' || group.kind === 'planned') {
		const copy = header.createEl('button', { cls: 'issues-icon-button' });
		setIcon(copy, 'lucide-clipboard-list');
		setTooltip(copy, 'Copy changelog');
		copy.addEventListener('click', (evt) => {
			evt.stopPropagation();
			void actions.copyChangelog(group);
		});
	}
	if (collapsed) return;
	renderRows(el, group.issues, actions);
}

function renderRows(parent: HTMLElement, issues: Issue[], actions: Actions): void {
	const rows = parent.createDiv({ cls: 'issues-rows' });
	for (const issue of issues) renderRow(rows, issue, actions);
}

interface HeaderSpec {
	label: string;
	count: number;
	collapsed: boolean;
	meta?: string | null;
	onToggle: () => void;
}

function renderHeader(parent: HTMLElement, spec: HeaderSpec): HTMLElement {
	const header = parent.createDiv({ cls: 'issues-header' });
	const chevron = header.createSpan({ cls: 'issues-chevron' });
	setIcon(chevron, spec.collapsed ? 'lucide-chevron-right' : 'lucide-chevron-down');
	header.createSpan({ cls: 'issues-header-label', text: spec.label });
	if (spec.meta) header.createSpan({ cls: 'issues-header-meta', text: spec.meta });
	header.createSpan({ cls: 'issues-header-count', text: String(spec.count) });
	header.createSpan({ cls: 'issues-header-spacer' });
	header.addEventListener('click', spec.onToggle);
	return header;
}
