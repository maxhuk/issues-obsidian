import { describe, expect, it } from 'vitest';
import { planCreateProject, suggestKey, validateProjectArgs } from './createProject';

describe('suggestKey', () => {
	it('takes the first three letters or digits, uppercased', () => {
		expect(suggestKey('Breathe')).toBe('BRE');
		expect(suggestKey('yoga + fitness')).toBe('YOG');
		expect(suggestKey('Go')).toBe('GO');
		expect(suggestKey('')).toBe('');
	});
});

describe('validateProjectArgs', () => {
	it('rejects empty or unsafe names and malformed keys', () => {
		expect(validateProjectArgs({ parentFolder: 'Projects', name: '  ', key: 'BRE' })).toMatch(/name/);
		expect(validateProjectArgs({ parentFolder: 'Projects', name: 'a/b', key: 'BRE' })).toMatch(/cannot contain/);
		expect(validateProjectArgs({ parentFolder: 'Projects', name: 'Breathe', key: 'bre' })).toMatch(/uppercase/);
		expect(validateProjectArgs({ parentFolder: 'Projects', name: 'Breathe', key: '1BRE' })).toMatch(/uppercase/);
		expect(validateProjectArgs({ parentFolder: 'Projects', name: 'Breathe', key: 'BRE' })).toBeNull();
	});
});

describe('planCreateProject', () => {
	it('creates the note with the embed and the base, under the parent folder', () => {
		const plan = planCreateProject({ parentFolder: 'Projects/', name: ' Breathe ', key: 'BRE' });
		expect(plan.folder).toBe('Projects/Breathe');
		expect(plan.plans[0]).toEqual({
			kind: 'create',
			path: 'Projects/Breathe/Breathe.md',
			frontmatter: { type: 'project', project: 'BRE' },
			body: '# Breathe\n\n![[Breathe.base]]\n',
		});
		expect(plan.plans[1].kind).toBe('file');
		expect(plan.plans[1].path).toBe('Projects/Breathe/Breathe.base');
		expect(plan.plans[1].content).toContain(`'project == "BRE"'`);
		expect(plan.plans[1].content).toContain('type: issues-list');
	});

	it('works at the vault root and throws on invalid input', () => {
		expect(planCreateProject({ parentFolder: '', name: 'Solo', key: 'SOLO' }).notePath).toBe('Solo/Solo.md');
		expect(() => planCreateProject({ parentFolder: '', name: 'Solo', key: 'so' })).toThrow(/uppercase/);
	});
});
