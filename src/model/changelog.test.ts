import { describe, expect, it } from 'vitest';
import { changelogText } from './changelog';
import { issue } from './fixtures';

describe('changelogText', () => {
	it('lists tasks in row order, then bugs under Fixes', () => {
		const text = changelogText([
			issue({ number: 1, title: 'Bug late', type: 'bug', order: null }),
			issue({ number: 2, title: 'Task two', order: 'a1' }),
			issue({ number: 3, title: 'Task one', order: 'a0' }),
			issue({ number: 4, title: 'Bug early', type: 'bug', order: 'a0' }),
		]);
		expect(text).toBe('- Task one\n- Task two\nFixes\n- Bug early\n- Bug late');
	});

	it('omits Fixes without bugs and handles an empty release', () => {
		expect(changelogText([issue({ title: 'Only task' })])).toBe('- Only task');
		expect(changelogText([])).toBe('');
	});
});
