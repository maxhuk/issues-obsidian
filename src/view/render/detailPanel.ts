import { MarkdownRenderer, setIcon, setTooltip, type App, type Component } from 'obsidian';
import type { Issue } from '../../types';
import type { Actions, ViewModel } from '../types';
import { readBody } from '../../vault/template';
import { compareVersionsDesc } from '../../model/sections';

export interface PanelContext {
	app: App;
	component: Component;
}

/** Spec 4.4. */
export function renderDetailPanel(parent: HTMLElement, issue: Issue, model: ViewModel, actions: Actions, ctx: PanelContext): void {
	const panel = parent.createDiv({ cls: 'issues-panel' });

	const top = panel.createDiv({ cls: 'issues-panel-top' });
	top.createSpan({ cls: 'issues-row-key', text: issue.key });
	const open = top.createEl('button', { cls: 'issues-icon-button' });
	setIcon(open, 'lucide-file-text');
	setTooltip(open, 'Open note');
	open.addEventListener('click', () => void actions.openNote(issue));
	const close = top.createEl('button', { cls: 'issues-icon-button issues-panel-close' });
	setIcon(close, 'lucide-x');
	setTooltip(close, 'Close');
	close.addEventListener('click', () => actions.closePanel());

	renderTitle(panel, issue, actions);
	const props = panel.createDiv({ cls: 'issues-props' });
	renderStatus(props, issue, model, actions);
	renderType(props, issue, actions);
	renderPriority(props, issue, actions);
	renderLabels(props, issue, model, actions);
	renderParent(props, issue, actions);
	if (model.config.releases && issue.status === model.config.statusReleased) renderRelease(props, issue, model, actions);

	const body = panel.createDiv({ cls: 'issues-body-render markdown-rendered' });
	void readBody(ctx.app, issue.path).then((markdown) => {
		if (markdown.trim() === '') {
			body.createDiv({ cls: 'issues-body-empty', text: 'No description. Open the note to add one.' });
			return;
		}
		return MarkdownRenderer.render(ctx.app, markdown, body, issue.path, ctx.component);
	});
}

function renderTitle(panel: HTMLElement, issue: Issue, actions: Actions): void {
	const input = panel.createEl('input', { cls: 'issues-panel-title', type: 'text', value: issue.title });
	input.addEventListener('focus', () => actions.beginInteraction());
	input.addEventListener('blur', () => {
		actions.endInteraction();
		const title = input.value.trim();
		if (title !== '' && title !== issue.title) void actions.patchIssue(issue, { title });
	});
	input.addEventListener('keydown', (evt) => {
		if (evt.key === 'Enter') input.blur();
		if (evt.key === 'Escape') {
			input.value = issue.title;
			input.blur();
		}
	});
}

function field(parent: HTMLElement, label: string): HTMLElement {
	const row = parent.createDiv({ cls: 'issues-prop' });
	row.createSpan({ cls: 'issues-prop-label', text: label });
	return row.createDiv({ cls: 'issues-prop-value' });
}

function select(parent: HTMLElement, options: { value: string; label: string }[], current: string, onChange: (value: string) => void): HTMLSelectElement {
	const el = parent.createEl('select', { cls: 'dropdown' });
	for (const option of options) el.createEl('option', { value: option.value, text: option.label });
	el.value = current;
	el.addEventListener('change', () => onChange(el.value));
	return el;
}

function renderStatus(parent: HTMLElement, issue: Issue, model: ViewModel, actions: Actions): void {
	const statuses = model.config.statuses.includes(issue.status) ? model.config.statuses : [...model.config.statuses, issue.status];
	select(
		field(parent, 'Status'),
		statuses.map((s) => ({ value: s, label: s })),
		issue.status,
		(value) => void actions.changeStatus(issue, value),
	);
}

function renderType(parent: HTMLElement, issue: Issue, actions: Actions): void {
	const value = field(parent, 'Type');
	const group = value.createDiv({ cls: 'issues-segmented' });
	for (const type of ['task', 'bug']) {
		const button = group.createEl('button', { text: type });
		button.toggleClass('is-active', issue.type === type);
		button.addEventListener('click', () => {
			if (issue.type !== type) void actions.patchIssue(issue, { type });
		});
	}
}

function renderPriority(parent: HTMLElement, issue: Issue, actions: Actions): void {
	select(
		field(parent, 'Priority'),
		['high', 'medium', 'low'].map((p) => ({ value: p, label: p })),
		issue.priority,
		(value) => void actions.patchIssue(issue, { priority: value }),
	);
}

function renderLabels(parent: HTMLElement, issue: Issue, model: ViewModel, actions: Actions): void {
	const value = field(parent, 'Labels');
	const chips = value.createDiv({ cls: 'issues-label-chips' });
	for (const label of issue.labels) {
		const chip = chips.createSpan({ cls: 'issues-chip issues-chip-label is-removable', text: label });
		const remove = chip.createSpan({ cls: 'issues-chip-remove' });
		setIcon(remove, 'lucide-x');
		remove.addEventListener('click', () => void actions.patchIssue(issue, { labels: issue.labels.filter((l) => l !== label) }));
	}
	const listId = `issues-labels-${issue.number}`;
	const input = chips.createEl('input', { type: 'text', placeholder: 'Add label', cls: 'issues-label-input' });
	input.setAttribute('list', listId);
	const datalist = value.createEl('datalist');
	datalist.id = listId;
	for (const label of model.labels.filter((l) => !issue.labels.includes(l))) datalist.createEl('option', { value: label });
	input.addEventListener('keydown', (evt) => {
		if (evt.key !== 'Enter') return;
		evt.preventDefault();
		const label = input.value.trim();
		if (label === '' || issue.labels.includes(label)) return;
		void actions.patchIssue(issue, { labels: [...issue.labels, label] });
	});
}

function renderParent(parent: HTMLElement, issue: Issue, actions: Actions): void {
	const value = field(parent, 'Parent');
	const button = value.createEl('button', { cls: 'issues-parent-button', text: issue.parent ?? 'Set parent' });
	button.addEventListener('click', () => actions.pickParent(issue));
}

function renderRelease(parent: HTMLElement, issue: Issue, model: ViewModel, actions: Actions): void {
	const releases = [...model.releases]
		.filter((r) => r.project === model.config.key)
		.sort((a, b) => Number(b.status === 'planned') - Number(a.status === 'planned') || compareVersionsDesc(a.version, b.version));
	const options = [
		{ value: '', label: 'No release' },
		...releases.map((r) => ({ value: r.basename, label: `${r.version}${r.status === 'planned' ? ' (planned)' : ''}` })),
	];
	if (issue.release !== null && !releases.some((r) => r.basename === issue.release)) {
		options.push({ value: issue.release, label: `${issue.release} (missing)` });
	}
	select(field(parent, 'Release'), options, issue.release ?? '', (value) => void actions.setRelease(issue, value === '' ? null : value));
}
