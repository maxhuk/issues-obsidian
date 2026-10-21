import type { CreateNote, Issue, NoteRecord } from '../types';

export interface InferredProject {
	key: string;
	folder: string;
	name: string;
	notePath: string;
}

function parentOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

function basename(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Spec 2.4: what the project note must have said, read off the issues that are left.
 * The key is the one every issue carries; the folder is the parent of the issues folder.
 */
export function inferProject(issues: Issue[]): InferredProject | null {
	const keys = new Set(issues.map((i) => i.project).filter((k) => k !== ''));
	if (keys.size !== 1) return null;
	const key = [...keys][0]!;

	const folders = new Map<string, number>();
	for (const issue of issues) {
		const folder = parentOf(parentOf(issue.path));
		folders.set(folder, (folders.get(folder) ?? 0) + 1);
	}
	const folder = [...folders.entries()].sort((a, b) => b[1] - a[1])[0]![0];
	const name = basename(folder) || key;
	return { key, folder, name, notePath: folder === '' ? `${name}.md` : `${folder}/${name}.md` };
}

/** A stand-in for the missing note, so the list can render with default configuration. */
export function syntheticProjectNote(inferred: InferredProject): NoteRecord {
	return { path: inferred.notePath, basename: inferred.name, frontmatter: { type: 'project', project: inferred.key } };
}

/** The recreated note: the two required properties and, when a base of the same name exists, its embed. */
export function planRecoverProjectNote(inferred: InferredProject, hasBase: boolean): CreateNote {
	const embed = hasBase ? `\n![[${inferred.name}.base]]\n` : '';
	return {
		kind: 'create',
		path: inferred.notePath,
		frontmatter: { type: 'project', project: inferred.key },
		body: `# ${inferred.name}\n${embed}`,
	};
}
