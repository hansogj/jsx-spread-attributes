# jsx-spread-attributes

Convert JSX attributes into a single spread object attribute VS Code refactor.

## What it does

This small VS Code extension provides two-way conversion between JSX attributes and spread objects:

1. Convert multiple attributes to a spread object:

```jsx
// Before
const d = "D";
<MyComp a="1" b={b} c d={d} />

// After
<MyComp {...{ b, d, a: "1", c: true }} />
```

2. Convert spread object back to individual attributes:

```jsx
// Before
<MyComp {...{ a: "1", b, c: true }} />

// After
<MyComp a="1" b={x} c />
```

The exact output formatting follows Babel-generated code and may vary slightly.

## Installation

- **From Marketplace**: search for `jsx-spread-attributes` in the Extensions view.
- **From the archived VSIX in this repo** — no clone needed:

```bash
curl -LO https://raw.githubusercontent.com/hansogj/vscode-extensions/main/packages/jsx-spread-attributes/downloads/jsx-spread-attributes-0.1.1.vsix
code --install-extension jsx-spread-attributes-0.1.1.vsix
```

- **By building locally** (when iterating on the extension):

```bash
pnpm install
pnpm --filter jsx-spread-attributes run vsix:package
code --install-extension packages/jsx-spread-attributes/jsx-spread-attributes-*.vsix
```

## Usage

- Open a JSX/TSX file (or a plain `.js`/`.ts` file with JSX enabled / editor language set to "JavaScript React" / "TypeScript React").
- Place the caret inside a JSX element that has multiple attributes (or select the tag).
- Press the lightbulb / press `Alt+Enter` on Windows/Linux (or `Cmd+.` on macOS) or right-click → `Refactor...`.
- Choose `Convert Attributes to Spread Object` from the Refactor menu.
- The element will be replaced with a version that uses a single spread attribute.

There is also a context menu command contributed: `jsx-attr-refactor.convertAttrToSpreadCommand` which appears under the Refactor group in the editor context menu.

## Development

Steps to run and develop locally:

1. Install dependencies

```bash
pnpm install
# or npm install
```

2. Run the extension in the Extension Development Host

- Open this project in VS Code and press `F5` to launch the Extension Development Host.
- Or run the watch build and tests via scripts (see below).

3. Build / watch

```bash
pnpm run watch          # builds the extension bundle in watch mode
pnpm run watch-tests    # watches TypeScript compilation for tests
```

4. Run tests

This repo uses the VS Code extension test harness. Run:

```bash
pnpm run compile-tests
pnpm run compile
pnpm test
```

Note: running the extension tests will start an instance of VS Code and can take a bit of time on the first run.

## Implementation notes

- The extension uses Babel (`@babel/parser`, `@babel/traverse`, `@babel/generator`) to parse and rewrite JSX.
- The Code Action Provider advertises itself as a `Refactor` provider so VS Code will call it from the lightbulb / Refactor menu. The action itself uses the custom kind `refactor.jsx.convertAttrToSpread` so it can be filtered or contributed in `package.json`.
- Parsing is performed with `ranges` enabled so the provider maps AST nodes to document offsets reliably.

## Contributing

Contributions are welcome. Please open issues or PRs for bugs or feature suggestions.

If you add new behavior that changes text edits, add a unit or integration test covering the change.

## License

MIT
