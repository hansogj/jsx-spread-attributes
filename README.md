# vscode-extensions

A pnpm-workspace monorepo for two small VS Code refactor extensions:

| Package | What it does |
| ------- | ------------ |
| [`jsx-spread-attributes`](./packages/jsx-spread-attributes) | Two-way refactor between JSX attributes and a single `{...{ ... }}` spread-object attribute. |
| [`concise-arrow`](./packages/concise-arrow) | Arrow-function brace refactors that fill the gaps TypeScript's built-in refactor leaves: remove braces from single-`ExpressionStatement` bodies, and add no-return braces to a concise body. |

Both are published under the VS Code Marketplace publisher `HansOleGjerdrum`.

## Install

Each package archives its `.vsix` releases under `packages/<package>/downloads/`. Install on any machine with the `code` CLI on `PATH`:

```bash
# jsx-spread-attributes
curl -LO https://raw.githubusercontent.com/hansogj/vscode-extensions/main/packages/jsx-spread-attributes/downloads/jsx-spread-attributes-0.1.1.vsix
code --install-extension jsx-spread-attributes-0.1.1.vsix

# concise-arrow
curl -LO https://raw.githubusercontent.com/hansogj/vscode-extensions/main/packages/concise-arrow/downloads/concise-arrow-0.1.0.vsix
code --install-extension concise-arrow-0.1.0.vsix
```

When published to the Marketplace, you can also install by searching for `jsx-spread-attributes` or `concise-arrow` in the Extensions view.

## Development

Requires `node 20+` and `pnpm 10+`.

```bash
git clone git@github.com:hansogj/vscode-extensions.git
cd vscode-extensions
pnpm install
```

Workspace-level scripts (run from the repo root):

```bash
pnpm run build           # webpack each package
pnpm run test            # vscode-test each package
pnpm run lint            # eslint each package
pnpm run package:vsix    # vsce package each package
```

To work on a single package:

```bash
pnpm --filter concise-arrow run watch
pnpm --filter jsx-spread-attributes test
```

Or `cd packages/<name>` and use that package's own scripts directly.

## Layout

```
packages/
├── jsx-spread-attributes/      # JSX attribute ↔ spread refactor
│   ├── src/extension.ts
│   ├── downloads/              # archived .vsix releases
│   └── ...
└── concise-arrow/              # arrow body ↔ braces refactor
    ├── src/extension.ts
    ├── downloads/
    └── ...
```

Each package's `README.md` and `CLAUDE.md` document its scope, architecture, and publishing procedure (browser upload, not `vsce publish` — see the publisher notes in either `CLAUDE.md`).

## License

MIT
