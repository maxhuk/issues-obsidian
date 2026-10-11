export type Frontmatter = Record<string, unknown>;

/** A note from the base, with frontmatter values already normalised by the vault layer. */
export interface NoteRecord {
	path: string;
	basename: string;
	frontmatter: Frontmatter;
}

export type Priority = 'high' | 'medium' | 'low';

export interface ProjectConfig {
	path: string;
	folder: string;
	name: string;
	key: string;
	releases: boolean;
	statuses: string[];
	statusesClosed: string[];
	/** Custom wording for the status table in AGENTS.md, keyed by status. Sparse. */
	statusMeanings: Record<string, string>;
	statusReleased: string;
	statusShipFrom: string;
	hideClosedAfterDays: number;
	issuesFolder: string;
	releasesFolder: string;
	issueTemplate: string | null;
}

export type ProjectParse = { ok: true; config: ProjectConfig } | { ok: false; error: string };

export interface Issue {
	path: string;
	key: string;
	number: number;
	title: string;
	project: string;
	type: string;
	status: string;
	priority: Priority;
	labels: string[];
	/** Basename of the parent issue, e.g. `BRE-100`. */
	parent: string | null;
	/** Basename of the release note, e.g. `BRE-1.5.0`. */
	release: string | null;
	order: string | null;
	/** `YYYY-MM-DD` */
	created: string | null;
	/** `YYYY-MM-DD` */
	closed: string | null;
}

export interface Release {
	path: string;
	basename: string;
	project: string;
	version: string;
	status: 'planned' | 'released';
	/** `YYYY-MM-DD` */
	released: string | null;
}

export interface Patch {
	kind: 'patch';
	path: string;
	set: Frontmatter;
	clear: string[];
}

export interface CreateNote {
	kind: 'create';
	path: string;
	frontmatter: Frontmatter;
	body: string;
}

/** A non-Markdown file written verbatim, such as a `.base`. */
export interface CreateFile {
	kind: 'file';
	path: string;
	content: string;
}

export type Plan = Patch | CreateNote | CreateFile;

export type ReleaseGroupKind = 'planned' | 'released' | 'dangling' | 'none';

export interface ReleaseGroup {
	id: string;
	kind: ReleaseGroupKind;
	release: Release | null;
	label: string;
	date: string | null;
	issues: Issue[];
	defaultCollapsed: boolean;
}

export interface Section {
	status: string;
	/** False for a status found on issues but absent from the project's list. */
	known: boolean;
	closed: boolean;
	/** True for the `status_released` section when releases are on. */
	grouped: boolean;
	issues: Issue[];
	hiddenCount: number;
	groups: ReleaseGroup[];
}
