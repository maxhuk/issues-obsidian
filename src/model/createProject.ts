import type { CreateFile, CreateNote } from '../types';

const KEY_PATTERN = /^[A-Z][A-Z0-9]*$/;

export interface CreateProjectArgs {
	/** Folder that will contain the project folder, e.g. `Projects`. Empty for the vault root. */
	parentFolder: string;
	name: string;
	key: string;
}

export interface CreateProjectPlan {
	folder: string;
	notePath: string;
	basePath: string;
	plans: [CreateNote, CreateFile];
}

/** A key suggestion from a name: the first three letters, uppercased. */
export function suggestKey(name: string): string {
	const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
	return letters.slice(0, 3);
}

export function validateProjectArgs(args: CreateProjectArgs): string | null {
	if (args.name.trim() === '') return 'A project needs a name';
	if (/[\\/:*?"<>|]/.test(args.name)) return 'The name is used as a folder and file name and cannot contain / \\ : * ? " < > |';
	if (!KEY_PATTERN.test(args.key)) return 'The key is uppercase letters and digits, starting with a letter, e.g. BRE';
	return null;
}

export function baseContent(key: string): string {
	return `filters:\n  and:\n    - 'project == "${key}"'\nviews:\n  - type: issues-list\n    name: Issues\n`;
}

/** Spec 3.5: the project note (with the base embedded) and the base file. */
export function planCreateProject(args: CreateProjectArgs): CreateProjectPlan {
	const error = validateProjectArgs(args);
	if (error) throw new Error(error);
	const name = args.name.trim();
	const parent = args.parentFolder.replace(/^\/+|\/+$/g, '');
	const folder = parent === '' ? name : `${parent}/${name}`;
	const notePath = `${folder}/${name}.md`;
	const basePath = `${folder}/${name}.base`;
	return {
		folder,
		notePath,
		basePath,
		plans: [
			{ kind: 'create', path: notePath, frontmatter: { type: 'project', project: args.key }, body: `# ${name}\n\n![[${name}.base]]\n` },
			{ kind: 'file', path: basePath, content: baseContent(args.key) },
		],
	};
}
