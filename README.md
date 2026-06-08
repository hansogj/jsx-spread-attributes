# concise-arrow

Arrow-function refactors that fill the gaps TypeScript's built-in refactor leaves.

## What it does

Two refactors, each covering a case the built-in TS refactor doesn't:

```ts
// Remove braces — handles the single ExpressionStatement body case (TS skips this)
() => { console.log(x); }   →   () => console.log(x)
() => { return x + 1; }     →   () => x + 1

// Add braces (no return) — wraps the body as a statement, dropping the return value
() => setOpen(true)         →   () => { setOpen(true); }
```

For the *other* combinations the built-in `tsserver` refactor already handles them, so concise-arrow stays out of the way:

| Source                       | Tool                                         |
| ---------------------------- | -------------------------------------------- |
| `() => { return x; }` → `() => x` | `tsserver` (also concise-arrow as a bonus)   |
| `() => { f(); }` → `() => f()`    | **concise-arrow only**                       |
| `() => x` → `() => { return x; }` | `tsserver`                                   |
| `() => f()` → `() => { f(); }`    | **concise-arrow only** (no-return variant)   |

The "add braces (no return)" variant is the natural shape for event handlers, `useEffect` bodies, and other void callbacks — when you want to add more statements without preserving the return value.

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
- Pick `Remove braces from arrow function` or `Add braces (no return)`.

Also exposed as commands:

- `concise-arrow.removeBracesCommand`
- `concise-arrow.addBracesNoReturnCommand`

## Languages

`javascript`, `typescript`, `javascriptreact`, `typescriptreact`.

## Implementation notes

- Parses with `@babel/parser` (`jsx` plugin + `typescript` or `flow`).
- Picks the *deepest* `ArrowFunctionExpression` whose range intersects the selection — so nested arrows behave intuitively.
- Pure AST transformation: build a fresh `ArrowFunctionExpression` with the same params, async/generator flags, return type, and type parameters; only the body changes.
- Emits via `@babel/generator`, which handles object-literal parenthesization, JSX bodies, and quoting.

## License

MIT
