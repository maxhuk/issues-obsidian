# Issues

A sectioned issue list for Obsidian, built as a custom Bases view. Notes are issues, frontmatter is the data, a project note is the configuration. Runs on desktop and mobile.

- What it does and how it behaves: [docs/spec.md](docs/spec.md)
- How the code is organised: [docs/architecture.md](docs/architecture.md)

## Set up a project in a vault

1. Create a folder, e.g. `Projects/Breathe/`.
2. Add a project note `Breathe.md` with at least:
   ```yaml
   type: project
   project: BRE
   ```
   The full list of project properties and their defaults is in the spec.
3. Add `Breathe.base`:
   ```yaml
   filters:
     and:
       - 'project == "BRE"'
   views:
     - type: issues-list
       name: Issues
   ```
4. Embed it in the project note with `![[Breathe.base]]`.

The first time the list renders, the plugin writes `AGENTS.md` into the project folder: the rules for creating and moving issues by editing files, specialised to that project. Agents and people working without the plugin read that file.

## Build and install

```bash
npm install
npm run build
cp install.config.example.json install.config.json   # set your vault path
npm run install:vault
```

Enable **Issues** under **Settings → Community plugins** and reload. `npm run dev` watches and builds into `dev-vault/` for development.
