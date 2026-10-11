# Issues — architecture

How the plugin is built. `docs/spec.md` says what it does; this document says where each part lives and the rules that keep it maintainable. Both describe the current state of the code only.

## 1. Stack

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict: true`, target ES2021 |
| Bundler | esbuild, single `main.js`, `obsidian` and Electron modules external, everything else bundled |
| Package manager | npm |
| Lint | ESLint with `eslint-plugin-obsidianmd` |
| Tests | Vitest, limited to `src/model/` |
| Runtime API | `obsidian` typings pinned to the version in `package.json`; `minAppVersion` in `manifest.json` is the oldest Obsidian the code is known to run on |
| Ordering | `fractional-indexing` (base62 keys) |

No UI framework. Rendering uses Obsidian's DOM helpers (`createDiv`, `createEl`, `setIcon`) so the view looks native and ships without a runtime dependency.

## 2. Repository layout

```
issues-obsidian/
  manifest.json           plugin id `issues`, name "Issues"
  versions.json           plugin version → minAppVersion
  package.json
  esbuild.config.mjs
  tsconfig.json
  eslint.config.mts
  styles.css              all plugin CSS; class prefix `issues-`
  src/
    main.ts               Plugin subclass: registerBasesView only
    types.ts              shared types: NoteRecord, ProjectConfig, Issue, Release, Section, ReleaseGroup, Plan (Patch | CreateNote)
    model/                pure TypeScript, no `obsidian` import, unit-tested
      ordering.ts         fractional keys, the row sort, placeAt (keys the unkeyed tail when a neighbour is unkeyed)
      project.ts          parse and validate the project note into ProjectConfig; defaults depend on `releases`
      partition.ts        split the base's notes by `type` into project / Release[] / Issue[]; link values → basename
      sections.ts         Section[] from issues + releases + config: unknown statuses, hide-by-age, release groups
      filter.ts           text filter over sections
      status.ts           status change rules → Patch; release change → Patch
      moves.ts            drop, send to top/bottom, move to status, order for a new row → Plan[]
      create.ts           issue and release creation → CreateNote; next number from existing keys
      ship.ts             ship-release plan → Plan[], release note first
      changelog.ts        release group → clipboard text
      agentsGuide.ts      renders a project's AGENTS.md from its ProjectConfig and the plugin version
      fixtures.ts         builders shared by the tests
    vault/                adapters that touch the Obsidian API
      entries.ts          BasesEntry → NoteRecord, frontmatter read from the metadata cache
      writer.ts           apply Plan[]: processFrontMatter for patches; vault.create + processFrontMatter for notes; folder creation
      template.ts         read a note body without its frontmatter (issue_template, panel body)
      agentsGuide.ts      write <project folder>/AGENTS.md when the rendered guide or version differs
    view/
      IssuesView.ts       BasesView subclass; UI state, model rebuild, rendering, deferral; implements Actions
      commands.ts         every write: picks releases, builds plans through model/, applies them, optimistic refresh
      overrides.ts        optimistic values shown until Bases reports the written data
      types.ts            ViewModel, Actions, DropTarget, AddInputState
      util.ts             todayIso, stripFrontmatter, scrollParent
      render/
        toolbar.ts        filter input, Ship button
        section.ts        sections, release groups, headers
        row.ts
        addRow.ts         bottom add row and the inline input
        detailPanel.ts
        rowMenu.ts
        releasePicker.ts  SuggestModal over planned releases + "New release…" version prompt
        parentPicker.ts   SuggestModal over the project's issues
      drag/
        dragController.ts pointer-event drag for mouse and touch: hold-to-lift, ghost, drop indicator, auto-scroll
  dev-vault/              a small vault with one fixture project for manual testing
  docs/
    spec.md
    architecture.md
```

A file over roughly 250 lines is a signal to split it along the responsibilities above.

## 3. The Bases contract

The plugin is a Bases view. Obsidian owns the query; the plugin owns rendering and writes.

- `main.ts` calls `this.registerBasesView('issues-list', { name, icon, factory })` and hands the view the manifest version for AGENTS.md. The id `issues-list` is stable API and never changes.
- `IssuesView extends BasesView`. `onDataUpdated()` is the only entry point for data. Because the base's filter selects every note carrying the project key, `this.data.data` contains the project note, the releases and the issues together; `partition.ts` separates them by `type`. A change to any of the three re-delivers the data, so no separate metadata listener exists.
- `this.data` and its entries are replaced on every update. Nothing holds a reference across updates; note records carry the file path and are rebuilt each time.
- The view ignores the base's groupBy and sort; it reads the ungrouped `data.data`.
- The view declares no options. Collapsed sections and release groups are stored with `config.set('collapsed', [...])`, which writes the `.base` file and therefore syncs across devices. The text filter, the detail-panel selection, the add input and the hidden-rows toggle are instance state.
- Property values are read from `metadataCache.getFileCache(entry.file).frontmatter` in `entries.ts`, which yields the YAML exactly as written; `partition.ts` then types them and reduces link values to their basename. The view never touches Bases `Value` objects.
- Writes go through `app.fileManager.processFrontMatter(file, fn)` for existing notes and `vault.create` for fresh ones. The plugin never parses or writes YAML itself.

## 4. Data flow

```
Bases query ──onDataUpdated──▶ entries.toRecords ──▶ partition ──▶ { project, releases, issues }
                                                                        │
                                                   project.parse ──────▶ sections.build ──▶ Section[]
                                                                                              │
                                                                             filter.apply ◀───┘
                                                                                  │
                                                                           render/* ──▶ DOM

user action ──▶ model/status | ordering | create | ship ──▶ Plan[] ──▶ writer.apply ──▶ vault
                                                                              │
                                                          optimistic UI ◀─────┘ ──▶ next onDataUpdated reconciles
```

Rules this flow enforces:

- **Model functions are pure and return plans.** `Plan` is `Patch` (`{ path, set, clear }`) or `CreateNote` (`{ path, frontmatter, body }`). A status change, a drop, a ship action and a creation all produce `Plan[]`; `writer.ts` applies them in order. Tests cover the planning, not the writing.
- **One write per changed note**, with one exception: a drop or Send to bottom next to unkeyed rows first keys every unkeyed issue of that section (spec 4.1). The plan lists those patches before the moved issue's patch.
- **Ship writes the release note first**, then the issues, so an interrupted ship is completed by running it again.
- **Optimistic ordering.** After a drop the view keeps an in-memory `order` override for the moved note until the next `onDataUpdated` reports the written value, so the row does not jump back while the file is saved.
- **Deferred updates.** While a drag is in progress or the title field is focused, incoming `onDataUpdated` calls set a dirty flag; the render runs when the interaction ends. The add input is rebuilt from instance state (status, position, draft) on every redraw and refocused.
- **No counters.** The next issue number is computed from the keys present in the data; `vault.create` rejects an existing path, which surfaces as a notice.

## 5. Rendering

- Re-render on every `onDataUpdated` (subject to deferral above) and on every local state change. Sections and rows are rebuilt; the scroll position, the open detail panel and the add-input state are restored from instance state after the rebuild.
- The detail panel's slot is mounted in the pane's `.view-content`, outside the note body, so it is not capped by the readable line width; the view removes it on unload. After each render the view is padded on the right by exactly the overlap with the open panel, if any.
- Rows are keyed by file path in a `Map` so the drag controller and the detail panel can find elements without querying the DOM by text.
- The detail panel renders the body with `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` and registers the panel as a child `Component` so embeds and links unload cleanly.
- All styling lives in `styles.css` using Obsidian CSS variables (`--background-primary`, `--text-muted`, `--interactive-accent`, `--size-4-*`, `--radius-s`). No inline styles, no hard-coded colours. Rows carry `touch-action: pan-y`, `-webkit-touch-callout: none` and `user-select: none`.
- Mobile layout is driven by `Platform.isPhone`: the panel becomes a fixed overlay and hover-only affordances become always visible. The drag controller handles both pointer types: a mouse drags after 4 px; a touch holds 350 ms within 8 px to lift, then moving drags and releasing without movement opens the row menu.

## 6. Error handling

- No project note, or more than one, in the view's data renders a single setup message inside the view and nothing else.
- A project note that fails the validation in spec 2.1 renders the setup message naming the failing property.
- With `releases` off, `ProjectConfig.releases` is `false` and every release code path (grouping, Ship, picker, panel control) is skipped at the model level, not hidden in the renderer.
- An issue with a `status` not in the project's list is shown in an extra section headed by that value, after the configured sections, so it is never silently hidden.
- Failed writes surface through `new Notice(...)` with the file name and are logged with `console.error`. The optimistic override is dropped so the list returns to the vault's truth.

## 7. Testing

- `npm test` runs Vitest over `src/model/`. Every model file has a sibling `*.test.ts`; `fixtures.ts` holds the shared builders. No Obsidian mocks.
- `dev-vault/` is a committed vault with one project, a dozen issues and two releases. `npm run dev` builds in watch mode into `dev-vault/.obsidian/plugins/issues/`. Open the vault in Obsidian and reload the plugin to check UI changes by hand, on desktop and on a phone through Obsidian Sync when needed.
- There are no UI or end-to-end tests.

## 8. Build and install

- `npm run build` type-checks and produces `main.js` at the repo root.
- `npm run install:vault` copies `main.js`, `manifest.json` and `styles.css` into the vault plugin folder named in `install.config.json` (git-ignored; see `install.config.example.json`). Obsidian Sync then carries the built plugin to other devices.
- Versions follow SemVer in `manifest.json` and `versions.json`; `npm version` updates both. No GitHub releases are published.

## 9. Documentation rules

- `README.md`: what the plugin is, how to set up a project in a vault, how to build and install.
- `docs/spec.md`: behaviour. Any change in behaviour updates it in the same commit.
- `docs/architecture.md`: this file. Any change to layout, data flow or tooling updates it in the same commit.
- `src/model/agentsGuide.ts`: the contract for writing issues by editing files, rendered into every project's `AGENTS.md`. Any change to the data model or to status rules updates it in the same commit.
- `CHANGELOG.md`: the only place where history lives, one entry per version.
- Docs describe the present. No comparisons with earlier states: no "previously", "no longer", "used to", "legacy", "migrated from", "replaces". A removed feature is deleted from the docs, not marked as removed.
- Code comments explain non-obvious reasons only. Identifiers carry the what.
