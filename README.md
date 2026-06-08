# concise-arrow

Toggle arrow function bodies between concise (`() => expr`) and block (`() => { ... }`) form — including the single-`ExpressionStatement` case that TypeScript's built-in refactor skips.

## What it does

Two-way refactor between the two arrow body shapes:

```ts
// Remove braces
() => { console.log(x); }   →   () => console.log(x)
() => { return x + 1; }     →   () => x + 1

// Add braces
() => x + 1                 →   () => { return x + 1; }
```

The built-in TypeScript refactor only offers brace removal when the body is *exactly* a `return` statement. This extension also handles single-`ExpressionStatement` bodies — the common shape produced by side-effectful callbacks like `console.log`, `arr.push`, `map.set`, etc.

Async, generic, and typed arrows are preserved:

```ts
async <T>(x: T): Promise<T> => { return x; }   →   async <T>(x: T): Promise<T> => x
```

Object-literal returns are parenthesized automatically:

```ts
() => { return { a: 1 }; }   →   () => ({ a: 1 })
```

Output formatting follows `@babel/generator` and is not configurable.

## Installation

- **From Marketplace** (when published): search for `concise-arrow` in the Extensions view.
- **From a local VSIX**:

```bash
pnpm install
pnpm run vsix:package
code --install-extension concise-arrow-*.vsix
```

## Usage

- Open a `.js` / `.ts` / `.jsx` / `.tsx` file.
- Place the caret inside an arrow function.
- Trigger the lightbulb (`Ctrl+.` / `Cmd+.`) or right-click → `Refactor…`.
- Pick `Remove braces from arrow function` or `Add braces to arrow function`.

Also exposed as commands:

- `concise-arrow.removeBracesCommand`
- `concise-arrow.addBracesCommand`

## Languages

`javascript`, `typescript`, `javascriptreact`, `typescriptreact`.

## Implementation notes

- Parses with `@babel/parser` (`jsx` plugin + `typescript` or `flow`).
- Picks the *deepest* `ArrowFunctionExpression` whose range intersects the selection — so nested arrows behave intuitively.
- Pure AST transformation: build a fresh `ArrowFunctionExpression` with the same params, async/generator flags, return type, and type parameters; only the body changes.
- Emits via `@babel/generator`, which handles object-literal parenthesization, JSX bodies, and quoting.

## License

MIT
