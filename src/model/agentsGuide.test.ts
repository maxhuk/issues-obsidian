import { describe, expect, it } from 'vitest';
import { renderAgentsGuide } from './agentsGuide';
import { config } from './fixtures';

describe('renderAgentsGuide', () => {
	const withReleases = renderAgentsGuide(config(), '0.1.0');

	it('is specialised with the project key, folders and statuses', () => {
		expect(withReleases).toContain('# Working with Breathe issues');
		expect(withReleases).toContain('Issues plugin 0.1.0');
		expect(withReleases).toContain('`Projects/Breathe/Breathe.md` (key `BRE`)');
		expect(withReleases).toContain('`Projects/Breathe/Issues/BRE-<n>.md`');
		expect(withReleases).toContain('| `released` | closed | Shipped in a release. |');
		expect(withReleases).toContain('project: BRE');
		expect(withReleases).toContain('release: "[[BRE-1.5.0]]"');
	});

	it('covers the release lifecycle when releases are on', () => {
		expect(withReleases).toContain('## Releases');
		expect(withReleases).toContain('### Ship a release');
		expect(withReleases).toContain('status` is `merged`');
	});

	it('omits every release passage when releases are off', () => {
		const off = renderAgentsGuide(config({ releases: false, statuses: ['todo', 'doing', 'done'], statusesClosed: ['done'] }), '0.1.0');
		expect(off).not.toContain('## Releases');
		expect(off).not.toContain('release:');
		expect(off).toContain('Releases are off for this project.');
		expect(off).toContain('| `todo` | open |  |');
		expect(off).toContain('status: todo');
	});

	it('uses status_meanings over the built-in wording, leaving others as they are', () => {
		const text = renderAgentsGuide(
			config({ releases: false, statuses: ['idea', 'next', 'dropped'], statusesClosed: ['dropped'], statusMeanings: { dropped: 'Will not be written.', next: 'Up next.' } }),
			'0.1.0',
		);
		expect(text).toContain('| `dropped` | closed | Will not be written. |');
		expect(text).toContain('| `next` | open | Up next. |');
		expect(text).toContain('| `idea` | open |  |');
	});

	it('never tells an agent to write order', () => {
		expect(withReleases).toContain('**Do not write `order`.**');
		expect(withReleases).not.toMatch(/\norder: /);
	});
});
