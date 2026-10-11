# Changelog

## 0.2.1

- `status_meanings` on the project note supplies the wording of the status table in `AGENTS.md`, one `status: meaning` entry per line.

## 0.2.0

- Command **New project**: a dialog for name, key and parent folder that creates the project note and the base and opens the note.

## 0.1.3

- Closed statuses are listed after all open ones, so released and canceled work sits at the very end.

## 0.1.2

- Sections are listed from the last stage to the first, so finished and in-progress work sits at the top and the inbox at the bottom.

## 0.1.1

- The detail panel's title wraps and is edited in a growing text area.
- The panel's overlap padding is recomputed whenever the pane resizes, including after switching between editing and reading view.

## 0.1.0

First version.

- Sectioned issue list as a Bases view type `issues-list`, one base per project.
- Project note as configuration: statuses, closed statuses, release settings, folders, template.
- Issues as notes with frontmatter; manual ordering with fractional keys written on drag.
- Row menu: Send to top, Send to bottom, Move to status.
- Detail panel with editable properties, created and modified dates, rendered body, copy key.
- Quick add at the top and bottom of every section.
- Releases as notes, Ship action, release grouping, changelog copy.
- Closed issues hide after a configurable number of days.
- Toolbar text filter.
- `AGENTS.md` written into every project folder with the file-editing contract.
- Desktop and mobile, including hold-to-drag on touch.
