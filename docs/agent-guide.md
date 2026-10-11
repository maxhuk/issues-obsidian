# Writing issues without the plugin

Agents working in an app repository create and move issues by editing vault files directly. The plugin tolerates that as long as the rules below hold. This guide is the contract; `docs/spec.md` is the full behaviour. Reordering rows is the one thing that has no file-level form: it is done in the plugin, through drag or the row menu.

## Find the project

Each app repository's `CLAUDE.md` names the absolute path of its project note. Read that note first. It has `type: project` and `project: <KEY>`, and may set `releases`, `statuses`, `statuses_closed`, `status_released`, `status_ship_from`, `issues_folder`, `releases_folder` and `issue_template`. Anything missing takes the defaults in the spec, section 2.1. Folders are relative to the project note's folder.

## Create an issue

1. List the files in the issues folder, take the highest `<KEY>-n` number and add one. Create the folder if it does not exist.
2. Create `<issues_folder>/<KEY>-<n>.md`. If the path already exists, you raced another writer: recompute and retry.

```markdown
---
title: Fix timer drift on iOS
project: BRE
type: task
status: backlog
priority: medium
labels: []
created: 2026-10-10
---
Timer drifts about 200 ms per minute when the app is backgrounded.

Acceptance: zero drift over a ten-minute session.
```

Rules for the frontmatter:

- Write `title`, `project`, `type`, `status`, `priority`, `labels`, `created`. This is what the plugin itself writes, minus `order`.
- `project` is the project's key, verbatim.
- `type` is `task` or `bug`.
- `status` is one of the project's `statuses`. Use `inbox` for something captured but not understood, `backlog` for understood work, or go straight to `doing` when starting on it.
- `priority` is `high`, `medium` or `low`.
- `created` is today as `YYYY-MM-DD`.
- `parent`, when used, is a quoted wikilink to another issue in the same project: `parent: "[[BRE-100]]"`.
- **Do not write `order`.** The plugin owns it. An issue without `order` sorts after every ordered row in its section, which is where fresh work belongs.
- Do not write `closed` or `release` on creation unless the status requires them (see the status rules). When `issue_template` is set on the project note, copy that note's body.

The body is Markdown. Describe the work, the acceptance criteria and, for bugs, how to reproduce. Keep it short; the title carries the row.

## Change status

Set `status` to another value from the project's `statuses`, **remove `order`** so the issue lands at the bottom of its target section, and apply these rules. "Closed" means listed in `statuses_closed`.

| Transition | Also do |
|---|---|
| Open → closed | Set `closed` to today (`YYYY-MM-DD`). |
| Closed → closed | Keep `closed`. |
| Closed → open | Remove `closed`. |
| Into `status_released` (projects with `releases: true`) | Also set `release` to a quoted wikilink to the release note, `release: "[[BRE-1.5.0]]"`. An issue in `status_released` without `release` shows in the "No release" group. Use this for a single issue that went out on its own, for instance in a hotfix. When a whole version went out, ship the release (below) so the release note and all merged issues change together. |
| Out of `status_released` | Also remove `release`. |

An agent may drive an issue through the whole cycle. A Sentry fix, for example: create the issue in `backlog` or straight into `doing`, work on it, set `pr` when the pull request is open, set `merged` when it lands, and ship it as part of a release once the build is in the stores. An agent may also move an issue backwards, for instance `doing` back to `backlog` when work is abandoned, or to `canceled` with `closed` set when the issue turns out to be invalid.

## Edit an issue

- Change `title`, `type`, `priority`, `labels`, `parent` and the body freely.
- Never rename the file, change `project`, or write `order`.
- Append to the body rather than rewriting it when adding progress notes. A dated heading (`## 2026-10-10`) is enough; there is no comment structure.
- Link to code with plain Markdown links or paths in the body. Use the issue key in commit messages and branch names; that is the only cross-reference that exists.

## Releases

Only when the project has `releases: true`. Release notes live in the releases folder (default `Releases/`), one per version, named `<KEY>-<version>.md`, for example `BRE-1.5.0.md`. The key prefix keeps wikilinks unique when several projects share a version number.

### Plan a release

Create `<releases_folder>/<KEY>-<version>.md`, creating the folder if needed:

```markdown
---
type: release
project: BRE
version: 1.5.0
status: planned
---
```

The body is free Markdown for release notes and may stay empty.

### Ship a release

This is what the plugin's Ship button does. Do it after the build is live, in this order:

1. On the release note: set `status: released` and `released` to today. Create the note in that state if no planned note exists.
2. For every issue of the project whose `status` is `status_ship_from` (`merged` by default): set `status` to `status_released`, `release` to `"[[<KEY>-<version>]]"`, `closed` to today, and remove `order`.

If some merged issues must stay out of the release, move them to another status first; Ship takes everything in `status_ship_from`. If step 2 is interrupted, run it again: the issues still in `status_ship_from` are exactly the unshipped ones.

### Changelog text

The what's-new text for the stores is derived from the release's issues, in this shape:

```
- <title of task 1>
- <title of task 2>
Fixes
- <title of bug 1>
```

Tasks first, then bugs under a `Fixes` line that is omitted when there are no bugs. Within each group, issues follow their list order: those with `order` ascending, then those without by `created` ascending. The plugin's "Copy changelog" produces exactly this; an agent producing it by hand follows the same rule so both paths agree.

### Undo a release

Rare. Set the release note back to `status: planned` and remove `released`; on each issue whose `release` names that note, set `status` to `status_ship_from`, remove `release`, `closed` and `order`.

## What breaks the list

- A duplicate key, from not recomputing the number after a collision.
- A `status` value that is not in the project's list. The issue lands in an extra section headed by that value until fixed.
- A hand-written `order`. The row lands at an arbitrary position in its section.
- `closed` present on an open issue, or missing on a closed one. The plugin treats a closed issue without `closed` as closed today, so it stays visible for `hide_closed_after_days` from the moment it is noticed.
- A released issue without `release`, or a release note marked `released` while its issues still sit in `merged`. Ship both sides together.
- Unquoted wikilinks in `parent` or `release`. YAML needs `"[[BRE-100]]"`.
- Dates in any format other than `YYYY-MM-DD`.
- A release note named without the key prefix. `[[1.5.0]]` is ambiguous across projects.

## Using the Obsidian CLI instead

When Obsidian is running on the machine, its command-line interface can create files and set properties through the app, which keeps the metadata cache in sync immediately. The rules above are the same whichever path writes the file. Direct file edits are picked up by Obsidian within a second of the file changing, including through Obsidian Sync from another device.
