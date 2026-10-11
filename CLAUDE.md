# issues-obsidian

An Obsidian community plugin: a Linear-style sectioned issue list as a custom Bases view. Read these before changing anything:

- `docs/spec.md` — behaviour. The spec is the source of truth; code follows it.
- `docs/architecture.md` — module layout, the Bases contract, data flow, testing, docs rules.
- `src/model/agentsGuide.ts` — the file-editing contract the plugin writes into every project's `AGENTS.md`. A change to the data model or the status rules updates it in the same commit.

## Working rules

- **Spec first.** A behaviour change edits `docs/spec.md` in the same commit as the code. If the spec does not say it, do not build it; ask.
- **Model is pure.** `src/model/` never imports `obsidian`. It returns `Plan[]` (patches and note creations) that `src/vault/` applies. New logic goes in `model/` with a test beside it.
- **One write per changed note**, through `processFrontMatter` or `vault.create`. Never parse or write YAML by hand. The only sanctioned multi-note write is keying unkeyed rows before a drop (spec 4.1).
- **Docs describe the present.** No comparisons with earlier states ("previously", "no longer", "used to", "legacy", "migrated from", "replaces"). History lives in `CHANGELOG.md` only.
- **No added dependencies without a reason in the commit message.** Keep `main.js` small; everything must run on mobile.
- **Stable ids.** The view type `issues-list` and the plugin id `issues` never change.
- **Styling** uses Obsidian CSS variables in `styles.css`, class prefix `issues-`. No inline styles.
- **Commands.** Plain `npm`: `npm run build`, `npm test`, `npm run lint`, `npm run dev`, `npm run install:vault`.
- **Verification.** Model changes: `npm test`. UI changes: build into `dev-vault/`, open it in Obsidian, check desktop and the phone layout (`Platform.isPhone` paths) before calling it done.
