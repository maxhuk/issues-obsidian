import type { Issue, ProjectConfig, Release, ReleaseGroup, Section } from '../types';

export interface ViewModel {
	config: ProjectConfig;
	issues: Issue[];
	releases: Release[];
	sections: Section[];
	/** Labels in use across the project, for suggestions. */
	labels: string[];
}

export interface DropTarget {
	status: string;
	groupId: string | null;
	/** Position among the target rows, moved issue excluded. */
	index: number;
}

export type AddPosition = 'top' | 'bottom';

export interface AddInputState {
	status: string;
	position: AddPosition;
	draft: string;
}

export interface Actions {
	openIssue(issue: Issue): void;
	closePanel(): void;
	openNote(issue: Issue): Promise<void>;
	setFilter(text: string): void;
	isCollapsed(id: string): boolean;
	toggleCollapsed(id: string): void;
	isRevealed(status: string): boolean;
	toggleRevealed(status: string): void;
	addInput: AddInputState | null;
	openAddInput(status: string, position: AddPosition): void;
	closeAddInput(): void;
	setAddDraft(text: string): void;
	createIssue(status: string, title: string, position: AddPosition): Promise<void>;
	sendTo(issue: Issue, where: 'top' | 'bottom'): Promise<void>;
	moveToStatus(issue: Issue, status: string): Promise<void>;
	drop(issue: Issue, target: DropTarget): Promise<void>;
	showRowMenu(issue: Issue, x: number, y: number): void;
	changeStatus(issue: Issue, status: string): Promise<void>;
	patchIssue(issue: Issue, set: Record<string, unknown>, clear?: string[]): Promise<void>;
	setRelease(issue: Issue, release: string | null): Promise<void>;
	pickParent(issue: Issue): void;
	ship(): Promise<void>;
	copyChangelog(group: ReleaseGroup): Promise<void>;
	beginInteraction(): void;
	endInteraction(): void;
	selectedPath: string | null;
	filterText: string;
	isPhone: boolean;
}
