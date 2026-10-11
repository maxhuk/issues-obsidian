# Issues — product specification

Issues is an Obsidian plugin that turns a folder of notes into a sectioned issue list, in the spirit of Linear, rendered as a custom [Bases](https://obsidian.md/help/bases) view. One vault holds many projects; each project is a folder with a project note, an issues folder, optionally a releases folder, and one `.base` file. Everything the plugin knows is stored in note frontmatter, so the vault stays usable without the plugin.

This document describes the behaviour of the current version. `CHANGELOG.md` records how it changed.

## 1. Vault layout

```
Projects/
  Breathe/
    Breathe.md            project note (type: project)
    Breathe.base          the base; one or more views of type issues-list
    Issues/
      BRE-123.md          one note per issue, file name is the key
    Releases/
      BRE-1.5.0.md        one note per release, file name is key-version
    Issues/Attachments/   files embedded from issue bodies, where Obsidian puts pasted attachments
```

Attachments are ordinary Obsidian attachments: pasted or dragged into the issue note and embedded from its body with `![[file]]`. The plugin does nothing special with them; the detail panel renders the embeds like any note. Where they land follows the vault's attachment setting, which for a "subfolder under current folder" setting named `Attachments` is the folder above.

The `Projects/<Name>/` arrangement is a convention. The plugin relies only on frontmatter and on the folder paths configured on the project note.

## 2. Data model

All properties are plain YAML frontmatter, typed as Obsidian property types (text, list, number, checkbox, date). Three kinds of note share one `project` property, which is how a base gathers them, and are told apart by `type`.

### 2.1 Project note

| Property | Type | Default | Meaning |
|---|---|---|---|
| `type` | text | | `project`. Required; it is what makes the note a project. |
| `project` | text | | The project key, e.g. `BRE`: uppercase letters, used as the issue key prefix and as the `project` value on every issue and release. Required. |
| `releases` | checkbox | `true` | Whether the project tracks releases. When `false`, nothing below that is marked *releases only* applies. |
| `statuses` | list | with releases `[inbox, backlog, next, doing, pr, merged, released, canceled]`; without `[inbox, backlog, next, doing, done, canceled]` | Ordered status vocabulary. Section order follows it. |
| `statuses_closed` | list | with releases `[released, canceled]`; without `[done, canceled]` | Statuses that end an issue's life. |
| `status_released` | text | `released` | Releases only. The status that ties an issue to a release. Must be listed in `statuses_closed`. |
| `status_ship_from` | text | `merged` | Releases only. The status whose issues Ship sweeps into `status_released`. |
| `hide_closed_after_days` | number | `14` | Issues in a closed status are hidden from their section when `today − closed > hide_closed_after_days`. `0` hides every closed issue. With releases on, the `status_released` section is exempt. |
| `issues_folder` | text | `Issues` | Issues folder, relative to the project note's folder. Created on first use. |
| `releases_folder` | text | `Releases` | Releases only. Releases folder, relative to the project note's folder. Created on first use. |
| `issue_template` | text | | Optional vault-relative path to a note whose body is copied into every new issue. |

The project's display name is the note's file basename.

Validation, checked whenever the project note changes: `type` is `project`; `project` is non-empty; `status_released` and `status_ship_from` are members of `statuses` and `status_released` is a member of `statuses_closed` (releases on only); every entry of `statuses_closed` is a member of `statuses`. A failed check replaces the list with a setup message naming the property.

Meaning of the default statuses:

| Status | Meaning |
|---|---|
| `inbox` | Captured, not yet looked at. |
| `backlog` | Understood, not chosen. |
| `next` | Chosen to be done soon. The pull list. |
| `doing` | In progress. |
| `pr` | A pull request is open. |
| `merged` | Landed on the main branch, not yet in a release. |
| `released` | Shipped in a release. Closed. |
| `done` | Finished, in projects without releases. Closed. |
| `canceled` | Will not be done. Closed. |

A status value is a lowercase word. The plugin never renames a status.

Turning `releases` from `true` to `false` on a project that has release data does not touch any note: issues whose status is absent from the (now different) default `statuses` show up in unknown-status sections (3.1), and `release` values are ignored. Set `statuses` explicitly before flipping if the vocabulary should be kept.

### 2.2 Issue note

File name is the key: `<project>-<number>.md`. Numbers are assigned as the highest number present in the issues folder plus one; there is no counter anywhere.

| Property | Type | Values | Meaning |
|---|---|---|---|
| `title` | text | | Issue title. Shown in the row. |
| `project` | text | project key | Which project the issue belongs to. |
| `type` | text | `task`, `bug` | Kind of work. Any other value renders as-is in the chip. |
| `status` | text | one of the project's `statuses` | Section the issue sits in. |
| `priority` | text | `high`, `medium`, `low` | Missing means `medium`. |
| `labels` | list | free text | Zero or more labels. |
| `parent` | text | wikilink to an issue | Optional parent issue, resolved by basename among the project's issues. |
| `release` | text | wikilink to a release | Releases only. Resolved by basename among the project's releases. |
| `order` | text | fractional-index key | Position within the section. Owned by the plugin and by the migration script; opaque to everyone else. |
| `created` | date | | Creation date. |
| `closed` | date | | Date the issue entered a closed status. Absent while open. |

The body is free Markdown. The plugin renders it and never edits it.

A note in the base whose `type` is neither `project` nor `release` is an issue.

### 2.3 Release note

Releases only. File name is `<project>-<version>.md`, e.g. `BRE-1.5.0.md`, so that wikilinks to releases are unique across projects.

| Property | Type | Values | Meaning |
|---|---|---|---|
| `type` | text | `release` | Marks the note as a release. |
| `project` | text | project key | Owning project. |
| `version` | text | | The version shown in headers and pickers, e.g. `1.5.0`. |
| `status` | text | `planned`, `released` | A planned release collects merged work; a released one is history. |
| `released` | date | | Set when the release ships. |

The body is free Markdown for release notes.

### 2.4 The base

One `.base` file per project. Its filter selects everything that carries the project key, so the project note, the issues and the releases all arrive in the view's data and every change to any of them re-renders the list.

```yaml
filters:
  and:
    - 'project == "BRE"'
views:
  - type: issues-list
    name: Issues
```

A view of this type expects exactly one note with `type: project` in its data. None, or more than one, replaces the list with a setup message. The base's own sort and group settings are ignored by this view type: sections are always statuses and rows are always in `order`.

Further views on the same base may add Bases filters, for example `labels.contains("ops")`, to give a narrower list with the same behaviour. Filters that exclude the project note break the view; filters that exclude releases only remove those releases from grouping and pickers.

The project note embeds the base with `![[Breathe.base]]` so opening the project note opens the list.

## 3. The list

### 3.1 Sections

One section per status, in the project's `statuses` order, every one present even when empty. After them, one section per status value found on issues but absent from `statuses`, headed by the raw value, so that no issue is ever hidden by configuration. A section header shows the status, the count of visible issues, a collapse chevron and an add button.

Collapsed state (sections and release groups) is stored in the view's config inside the `.base` file, so it is one state across devices and survives reloads. Release groups that start collapsed by default remember being opened the same way.

Rules that change what a section shows:

- **Closed sections** (`statuses_closed`, minus `status_released` when releases are on): an issue is hidden when `today − closed > hide_closed_after_days`. An issue in a closed status without a `closed` date counts as closed today; the plugin does not write the missing value. The header shows how many are hidden and a toggle that reveals them for the current session.
- **The released section** (`status_released`, releases on only): issues are grouped by `release`. Groups are ordered: planned releases first, by version descending; then released ones, by `released` date descending; then groups for `release` values whose note does not exist, headed by the link text; then a final "No release" group for issues without `release`. Each group header shows the version, the date or "planned", a count and a collapse chevron. The first released group starts expanded; all others start collapsed. Nothing in this section is hidden by age.
- **Every other section** shows all its issues.

### 3.2 Rows

A row is one line on desktop and may wrap to two on narrow screens. From left to right:

1. Drag handle, visible on hover on desktop, always present but subtle on mobile.
2. Type icon: a blue checked square for a task, a red bug for a bug. Any other `type` value draws the task icon; the tooltip shows the raw value.
3. Key, in a muted monospace style.
4. Title.
5. Priority icon, only when not `medium`: double chevron up in orange for `high`, single chevron down in faint ink for `low`.
6. Chips: one per label, and a parent chip showing the parent's key when `parent` is set. The parent chip opens the parent in the detail panel.

Rows within a section are sorted by `order` ascending; issues without `order` sort after every keyed row, by `created` ascending. Clicking a row opens it in the detail panel. The whole row is the hit target.

### 3.3 Toolbar

The plugin renders its own toolbar inside the view, below Obsidian's Bases toolbar:

- A text filter. Typing narrows visible rows to those whose title, key or labels contain the text, case-insensitively. It never reveals rows hidden by age or by collapse. Section headers stay, counts reflect the matches, add rows stay. The filter is session state.
- A "Ship" button, present only when the project has releases on and at least one issue in `status_ship_from`. See 4.5.

### 3.4 Adding issues

Each section offers two ways to add:

- The header's add button reveals an input at the top of the section.
- A permanent "Add issue" row sits at the bottom of every section.

Typing a title and pressing Enter creates the issue with that section's status and an `order` that places it where the input was. Shift+Enter creates and keeps the input open for the next title. Escape closes the input. An empty title does nothing.

Creation writes exactly these properties: `title`, `project`, `type: task`, `status`, `priority: medium`, `labels: []`, `created` (today), `order`. When the section's status is closed, the rules of 4.3 apply before the file is written (`closed` today; for `status_released`, the release picker first). The body is the body of `issue_template` when set, otherwise empty. The file is `<issues_folder>/<project>-<n>.md` with `n` the highest existing number plus one; creation fails with a notice if that path already exists. The issues folder is created when missing.

## 4. Changing issues

### 4.1 Drag and drop

Desktop: press and drag a row by its handle or by the row itself. Dropping within the same section reorders; dropping in another section moves the issue to that status and places it at the drop position. Dragging near the top or bottom edge of the scroll container auto-scrolls.

Mobile: press and hold a row for 350 ms without moving more than 8 px to lift it. Moving the finger then drags; lifting the finger without having moved opens the row menu (4.2). Dragging works within the row's own section and into other sections. Rows declare `touch-action: pan-y` and `-webkit-touch-callout: none; user-select: none` so the hold does not select text or open the system menu; once lifted, touch moves are consumed by the drag.

Drops in the released section: into a release group sets that group's release without asking; onto the section header or into the "No release" group opens the release picker (4.3).

A drop writes a new `order` for the moved issue, between its new neighbours, plus `status` when the section changed, applying 4.3. When a neighbour has no `order`, the plugin first assigns keys to every unkeyed issue of that section, in their current display order, and then places the moved issue; this is the one case where a drop writes more than one note. The list shows the new position immediately and reconciles when Bases delivers the updated data.

### 4.2 Row menu

Right-click on desktop; on mobile, hold and release without moving (4.1). The menu has exactly:

- **Send to top** — new `order` before the first row of the section.
- **Send to bottom** — new `order` after the last row of the section, keying unkeyed rows first as in 4.1.
- **Move to <status>** — one entry per status in the project's order, the current status disabled. Moving places the issue at the top of the target section.

### 4.3 Status change rules

Every status change, whatever triggered it, applies these rules. "Closed" means listed in `statuses_closed`.

- Open → closed: set `closed` to today.
- Closed → closed: keep `closed` as it is.
- Closed → open: remove `closed`.
- Releases on, into `status_released`: a release is required. The plugin asks with a picker listing the project's planned releases by version descending, plus "New release…" which prompts for a version, creates `<releases_folder>/<project>-<version>.md` as `planned` (creating the folder when missing), and selects it. The chosen release is written to `release`.
- Releases on, out of `status_released`: remove `release`.

### 4.4 Detail panel

Opens when a row is clicked. On desktop it is a drawer anchored to the right edge of the pane, using the space that Obsidian's readable line width leaves free beside the note; when the pane is too narrow for both, the list gets right padding so no row is covered. On phones it covers the view and has a close button. Escape closes it on desktop. Selecting another row replaces its content.

Contents, top to bottom:

1. Key and an "Open note" button. Open note opens the issue in a new split on desktop and in the main view on mobile.
2. Title, editable inline. Blur or Enter saves.
3. Property controls: status (dropdown over the project's statuses, applying 4.3), type (two-way toggle), priority (dropdown), labels (chip input with suggestions from labels used in the project), parent (search over the project's issues by key or title, clearable), and, with releases on and only while the status is `status_released`, release (dropdown over the project's releases, clearable; clearing moves the issue to the "No release" group).
4. The note body rendered as Markdown, read-only. Wikilinks and embeds resolve as in a normal note.

Every control writes through the frontmatter API immediately. There is no save button.

### 4.5 Ship a release

Releases on only. The toolbar's Ship button opens the same release picker as 4.3. Confirming writes, in this order: first the release note (`status: released`, `released` today), then every issue in `status_ship_from` (`status` to `status_released`, `release` to the chosen release, `closed` to today). Writes are sequential and the button is disabled until they finish. If a write fails, the notice names the file; running Ship again with the same release finishes the remaining issues, since the release note is already marked and the issues still in `status_ship_from` are exactly the unshipped ones.

A release group header in the released section has a "Copy changelog" action. It copies to the clipboard:

```
- <title of task 1>
- <title of task 2>
Fixes
- <title of bug 1>
```

Tasks first, then bugs under a `Fixes` line, each in the section's row order (3.2). The `Fixes` line is omitted when there are no bugs.

## 5. Platform behaviour

- The plugin runs on desktop and mobile; `isDesktopOnly` is false.
- Sync is the user's concern. Obsidian Sync carries notes, the base and the plugin's built files between devices; the plugin stores nothing outside the vault.
- Obsidian's theme variables drive all colours and spacing. The list respects light and dark themes without plugin settings.
- Data updates that arrive during a drag or while the title field is focused are applied after that interaction ends, so a lifted row and an edit in progress are never discarded. An open add input survives a redraw with its text and focus intact, so rows created with Shift+Enter appear while typing continues.
- There are no plugin settings, no commands, no network calls and no telemetry.

## 6. Out of scope

Stated so they are not built by accident:

- Boards, swimlanes, calendars and any view other than the sectioned list.
- Grouping by anything other than status, and sorting by anything other than `order`.
- Cross-project views. One base per project.
- Keyboard navigation beyond Enter and Escape in inputs.
- Sprints, estimates, time tracking, assignees.
- Editing the note body inside the panel.
- Comments as a structured concept. Comments are plain paragraphs in the body.
- Deleting or archiving issues from the list. Use the file explorer.
