import { describe, expect, it } from 'vitest';
import { inferProject, planRecoverProjectNote, syntheticProjectNote } from './recover';
import { parseProject } from './project';
import { issue } from './fixtures';

describe('inferProject', () => {
	it('reads the key and the folder off the issues', () => {
		const inferred = inferProject([issue({ number: 1 }), issue({ number: 2 })]);
		expect(inferred).toEqual({ key: 'BRE', folder: 'Projects/Breathe', name: 'Breathe', notePath: 'Projects/Breathe/Breathe.md' });
	});

	it('gives up when the issues disagree on the key or there are none', () => {
		expect(inferProject([])).toBeNull();
		expect(inferProject([issue({ number: 1 }), { ...issue({ number: 2 }), project: 'YOG' }])).toBeNull();
	});

	it('picks the most common folder and falls back to the key as name at the vault root', () => {
		const stray = { ...issue({ number: 3 }), path: 'Elsewhere/Issues/BRE-3.md' };
		expect(inferProject([issue({ number: 1 }), issue({ number: 2 }), stray])!.folder).toBe('Projects/Breathe');
		const root = { ...issue({ number: 1 }), path: 'Issues/BRE-1.md' };
		expect(inferProject([root])).toEqual({ key: 'BRE', folder: '', name: 'BRE', notePath: 'BRE.md' });
	});
});

describe('syntheticProjectNote', () => {
	it('parses into a default configuration', () => {
		const parsed = parseProject(syntheticProjectNote(inferProject([issue()])!));
		expect(parsed.ok && parsed.config.key).toBe('BRE');
		expect(parsed.ok && parsed.config.issuesFolder).toBe('Projects/Breathe/Issues');
	});
});

describe('planRecoverProjectNote', () => {
	it('writes the two required properties and embeds the base when there is one', () => {
		const inferred = inferProject([issue()])!;
		expect(planRecoverProjectNote(inferred, true)).toEqual({
			kind: 'create',
			path: 'Projects/Breathe/Breathe.md',
			frontmatter: { type: 'project', project: 'BRE' },
			body: '# Breathe\n\n![[Breathe.base]]\n',
		});
		expect(planRecoverProjectNote(inferred, false).body).toBe('# Breathe\n');
	});
});
