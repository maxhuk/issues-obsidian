import { BasesView, Platform, type QueryController } from 'obsidian';
import type { Issue, ProjectConfig, ReleaseGroup } from '../types';
import { filterSections } from '../model/filter';
import { partition } from '../model/partition';
import { parseProject } from '../model/project';
import { buildSections } from '../model/sections';
import { syncAgentsGuide } from '../vault/agentsGuide';
import { toRecords } from '../vault/entries';
import { Commands } from './commands';
import { DragController } from './drag/dragController';
import { OverrideStore } from './overrides';
import { renderDetailPanel } from './render/detailPanel';
import { showRowMenu } from './render/rowMenu';
import { renderSection } from './render/section';
import { renderToolbar } from './render/toolbar';
import type { Actions, AddInputState, AddPosition, DropTarget, ViewModel } from './types';
import { scrollParent, todayIso } from './util';

export const VIEW_TYPE = 'issues-list';

/** Owns UI state and rendering; every write goes through `Commands`. */
export class IssuesView extends BasesView implements Actions {
	readonly type = VIEW_TYPE;
	readonly isPhone = Platform.isPhone;

	filterText = '';
	selectedPath: string | null = null;
	addInput: AddInputState | null = null;

	private readonly containerEl: HTMLElement;
	private rootEl!: HTMLElement;
	private toolbarEl!: HTMLElement;
	private listEl!: HTMLElement;
	private panelEl!: HTMLElement;
	private panelHost: HTMLElement | null = null;
	private commands!: Commands;
	private drag!: DragController;
	private viewModel: ViewModel | null = null;
	private setupMessage = 'Loading…';
	private readonly revealed = new Set<string>();
	private readonly overrides = new OverrideStore();
	private interactions = 0;
	private dirty = false;
	private guideSyncedFor = '';

	constructor(
		controller: QueryController,
		containerEl: HTMLElement,
		private readonly pluginVersion: string,
	) {
		super(controller);
		this.containerEl = containerEl;
	}

	onload(): void {
		this.commands = new Commands({
			app: this.app,
			model: () => this.viewModel,
			overrides: this.overrides,
			refresh: () => {
				this.rebuildModel();
				this.renderAll();
			},
			refreshPanel: () => this.renderPanel(),
		});
		this.rootEl = this.containerEl.createDiv({ cls: 'issues-view' });
		this.rootEl.toggleClass('is-phone', this.isPhone);
		this.toolbarEl = this.rootEl.createDiv({ cls: 'issues-toolbar-slot' });
		const body = this.rootEl.createDiv({ cls: 'issues-body' });
		this.listEl = body.createDiv({ cls: 'issues-list' });
		this.panelEl = this.mountPanelSlot();
		this.registerDomEvent(window, 'resize', () => this.layoutPanel());
		this.drag = new DragController(this.listEl, {
			isTouch: this.isPhone,
			onBegin: () => this.beginInteraction(),
			onEnd: () => this.endInteraction(),
			onDrop: (path, target) => {
				const issue = this.findIssue(path);
				if (issue) void this.drop(issue, target);
			},
			onMenu: (path, x, y) => {
				const issue = this.findIssue(path);
				if (issue) this.showRowMenu(issue, x, y);
			},
		});
		this.registerDomEvent(this.rootEl, 'issues:open-parent' as keyof HTMLElementEventMap, (evt) => {
			const key = (evt as CustomEvent<string>).detail;
			const parent = this.viewModel?.issues.find((i) => i.key === key);
			if (parent) this.openIssue(parent);
		});
		this.registerDomEvent(document, 'keydown', (evt) => {
			if (evt.key !== 'Escape' || this.selectedPath === null || this.isPhone) return;
			const active = document.activeElement;
			if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement) return;
			this.closePanel();
		});
	}

	onunload(): void {
		this.drag.destroy();
		this.panelEl.remove();
		this.panelHost?.removeClass('issues-panel-host');
	}

	/**
	 * The panel lives in the pane's content element, not inside the note body, so it can use the
	 * horizontal space that "Readable line length" leaves free instead of squeezing the list.
	 */
	private mountPanelSlot(): HTMLElement {
		const host = this.containerEl.closest<HTMLElement>('.view-content');
		if (!host || this.isPhone) return this.rootEl.createDiv({ cls: 'issues-panel-slot' });
		this.panelHost = host;
		host.addClass('issues-panel-host');
		return host.createDiv({ cls: 'issues-panel-slot is-floating' });
	}

	/** Pads the whole view on the right only when the floating panel would cover it. */
	private layoutPanel(): void {
		if (!this.panelEl.hasClass('is-floating')) return;
		if (!this.rootEl.hasClass('has-panel')) {
			this.rootEl.setCssProps({ '--issues-panel-overlap': '0px' });
			return;
		}
		this.rootEl.setCssProps({ '--issues-panel-overlap': '0px' });
		window.requestAnimationFrame(() => {
			const overlap = this.rootEl.getBoundingClientRect().right - this.panelEl.getBoundingClientRect().left;
			this.rootEl.setCssProps({ '--issues-panel-overlap': `${Math.max(0, Math.ceil(overlap))}px` });
		});
	}

	onDataUpdated(): void {
		if (this.interactions > 0) {
			this.dirty = true;
			return;
		}
		this.rebuildModel();
		this.renderAll();
	}

	// ----- model -----

	private rebuildModel(): void {
		const { projects, releases, issues } = partition(toRecords(this.app, this.data.data));
		if (projects.length !== 1) {
			this.viewModel = null;
			this.setupMessage =
				projects.length === 0
					? 'No project note in this base. Add a note with `type: project` and `project: <KEY>` matching the base filter.'
					: `This base contains ${projects.length} project notes; it needs exactly one.`;
			return;
		}
		const parsed = parseProject(projects[0]!);
		if (!parsed.ok) {
			this.viewModel = null;
			this.setupMessage = `Project note ${projects[0]!.basename}: ${parsed.error}`;
			return;
		}
		const config = parsed.config;
		this.keepAgentsGuideCurrent(config);
		const merged = issues.map((issue) => this.overrides.resolve(issue));
		const labels = [...new Set(merged.flatMap((i) => i.labels))].sort();
		const sections = buildSections({ issues: merged, releases, config, today: todayIso(), revealed: this.revealed });
		this.viewModel = { config, issues: merged, releases, sections, labels };
		if (this.selectedPath !== null && !merged.some((i) => i.path === this.selectedPath)) this.selectedPath = null;
	}

	/** Spec 2.5: AGENTS.md follows the configuration and the plugin version; checked once per distinct config. */
	private keepAgentsGuideCurrent(config: ProjectConfig): void {
		const signature = JSON.stringify(config);
		if (signature === this.guideSyncedFor) return;
		this.guideSyncedFor = signature;
		syncAgentsGuide(this.app, config, this.pluginVersion).catch((error: unknown) => {
			this.guideSyncedFor = '';
			console.error('Issues: could not write AGENTS.md', error);
		});
	}

	private findIssue(path: string): Issue | undefined {
		return this.viewModel?.issues.find((i) => i.path === path);
	}

	// ----- rendering -----

	private renderAll(): void {
		this.toolbarEl.empty();
		if (!this.viewModel) {
			this.listEl.empty();
			this.panelEl.empty();
			this.rootEl.removeClass('has-panel');
			this.listEl.createDiv({ cls: 'issues-setup', text: this.setupMessage });
			return;
		}
		renderToolbar(this.toolbarEl, this.viewModel, this);
		this.renderList();
		this.renderPanel();
	}

	private renderList(): void {
		if (!this.viewModel) return;
		const scroller = scrollParent(this.listEl);
		const scrollTop = scroller.scrollTop;
		this.listEl.empty();
		for (const section of filterSections(this.viewModel.sections, this.filterText)) renderSection(this.listEl, section, this);
		for (const row of Array.from(this.listEl.querySelectorAll<HTMLElement>('.issues-row'))) this.drag.attach(row);
		scroller.scrollTop = scrollTop;
	}

	private renderPanel(): void {
		this.panelEl.empty();
		const issue = this.selectedPath === null ? undefined : this.findIssue(this.selectedPath);
		this.rootEl.toggleClass('has-panel', issue !== undefined);
		this.panelEl.toggleClass('is-open', issue !== undefined);
		if (issue && this.viewModel) renderDetailPanel(this.panelEl, issue, this.viewModel, this, { app: this.app, component: this });
		this.layoutPanel();
	}

	// ----- Actions: UI state -----

	openIssue(issue: Issue): void {
		this.selectedPath = issue.path;
		this.renderList();
		this.renderPanel();
	}

	closePanel(): void {
		this.selectedPath = null;
		this.renderList();
		this.renderPanel();
	}

	async openNote(issue: Issue): Promise<void> {
		const file = this.app.vault.getFileByPath(issue.path);
		if (!file) return;
		await this.app.workspace.getLeaf(this.isPhone ? false : 'split').openFile(file);
	}

	setFilter(text: string): void {
		this.filterText = text;
		this.renderList();
	}

	private collapsedIds(): string[] {
		const stored = this.config.get('collapsed');
		return Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : [];
	}

	isCollapsed(id: string): boolean {
		return this.collapsedIds().includes(id);
	}

	toggleCollapsed(id: string): void {
		const ids = this.collapsedIds();
		this.config.set('collapsed', ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]);
		this.renderList();
	}

	isRevealed(status: string): boolean {
		return this.revealed.has(status);
	}

	toggleRevealed(status: string): void {
		if (this.revealed.has(status)) this.revealed.delete(status);
		else this.revealed.add(status);
		this.rebuildModel();
		this.renderList();
	}

	openAddInput(status: string, position: AddPosition): void {
		this.addInput = { status, position, draft: this.addInput?.draft ?? '' };
		this.renderList();
	}

	closeAddInput(): void {
		this.addInput = null;
		this.renderList();
	}

	setAddDraft(text: string): void {
		if (this.addInput) this.addInput.draft = text;
	}

	showRowMenu(issue: Issue, x: number, y: number): void {
		if (this.viewModel) showRowMenu(issue, this.viewModel.config, this, x, y);
	}

	beginInteraction(): void {
		this.interactions++;
	}

	endInteraction(): void {
		this.interactions = Math.max(0, this.interactions - 1);
		if (this.interactions === 0 && this.dirty) {
			this.dirty = false;
			this.onDataUpdated();
		}
	}

	// ----- Actions: writes, delegated -----

	createIssue(status: string, title: string, position: AddPosition): Promise<void> {
		return this.commands.createIssue(status, title, position);
	}

	sendTo(issue: Issue, where: 'top' | 'bottom'): Promise<void> {
		return this.commands.sendTo(issue, where);
	}

	moveToStatus(issue: Issue, status: string): Promise<void> {
		return this.commands.moveToStatus(issue, status);
	}

	drop(issue: Issue, target: DropTarget): Promise<void> {
		return this.commands.drop(issue, target);
	}

	changeStatus(issue: Issue, status: string): Promise<void> {
		return this.commands.changeStatus(issue, status);
	}

	patchIssue(issue: Issue, set: Record<string, unknown>, clear?: string[]): Promise<void> {
		return this.commands.patchIssue(issue, set, clear);
	}

	setRelease(issue: Issue, release: string | null): Promise<void> {
		return this.commands.setRelease(issue, release);
	}

	pickParent(issue: Issue): void {
		void this.commands.pickParent(issue);
	}

	ship(): Promise<void> {
		return this.commands.ship();
	}

	copyChangelog(group: ReleaseGroup): Promise<void> {
		return this.commands.copyChangelog(group);
	}
}
