# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

VS Code extension (`jsx-spread-attributes`, publisher `HansOleGjerdrum`) that provides two-way refactoring between JSX attributes and a single `{...{ ... }}` spread-object attribute. Exposed as both Code Actions (lightbulb/Refactor menu under kinds `refactor.jsx.convertAttrToSpread` and `refactor.jsx.convertSpreadToAttr`) and commands (`jsx-attr-refactor.convertAttrToSpreadCommand`, `jsx-attr-refactor.convertSpreadToAttrCommand`).

Activates on `javascript`, `typescript`, `javascriptreact`, `typescriptreact`. Engine `vscode ^1.100.0`. Uses pnpm.

## Commands

```bash
pnpm install                # install deps
pnpm run watch              # webpack watch (extension bundle)
pnpm run watch-tests        # tsc -w for tests (outputs to ./out)
pnpm run compile            # webpack one-shot build to ./dist
pnpm run compile-tests      # tsc -p . --outDir out
pnpm run lint               # eslint src
pnpm test                   # vscode-test (runs out/test/**/*.test.js in a VS Code instance)
pnpm run package            # production webpack build
pnpm run vsix:package       # vsce package --no-dependencies
```

`pretest` runs `compile-tests`, `compile`, and `lint`, so `pnpm test` covers them. Press `F5` in VS Code to launch the Extension Development Host.

To run a single test, filter via mocha grep through vscode-test, e.g. `pnpm test -- --grep "provideCodeActions"` (after `compile-tests`).

## Architecture

Single-file implementation: `src/extension.ts`. The extension has three logical layers:

1. **`JsxAttrRefactorProvider.provideCodeActions`** — VS Code entry point. Parses the whole document with `@babel/parser` (`sourceType: "module"`, `ranges: true`, `jsx` plugin plus `typescript` for `.tsx` or `flow` otherwise). Parse failure returns no actions (silently — incomplete code while typing is expected).

2. **`findBestMatch`** — traverses the AST and picks the *deepest* `JSXOpeningElement` whose parent `JSXElement` range intersects the cursor selection. Range resolution prefers Babel's numeric `start`/`end` offsets (because `ranges: true` is set) and falls back to `loc` line/column. An element is "eligible" if it has either >1 regular attribute (convertible to spread) or any spread attribute (convertible back).

3. **Rewriters** — `rewriteAttributesToSpread` and `rewriteSpreadToAttributes` operate purely on AST nodes and use `@babel/generator` to emit the new opening tag. Both build a fresh `JSXOpeningElement`, then `generateFullElementCode` re-emits children + closing tag from the original element so only the opening tag actually changes semantically. Output formatting follows Babel's generator and is not configurable.

Edge cases the rewriters handle explicitly:
- Attributes with no value (`<C disabled />`) → `disabled: true`, and the reverse.
- Hyphenated attribute names → string-literal property key (`"data-foo": …`).
- Shorthand object properties (`{ x }`) round-trip to attribute-without-value form.
- `JSXSpreadAttribute` whose argument is an object literal is merged into the destination object; non-literal spreads (`{...props}`) are preserved as `SpreadElement` entries inside the new object.
- Properties with computed/complex keys are skipped on the spread→attributes path.

Code Action kinds are constructed via `vscode.CodeActionKind.Refactor.append(...)` and must match the `kind` strings registered in `package.json` under `contributes.codeActions` for the lightbulb to advertise them.

## Build/output layout

- `src/extension.ts` → webpack → `dist/extension.js` (the published bundle; `main` in package.json).
- `src/**` and `test/**` → tsc → `out/` (only the test runner uses this; vscode-test loads `out/test/**/*.test.js`).
- `@babel/*` is bundled into `dist/extension.js`; only `vscode` is declared as an external.
- `downloads/` holds historical `.vsix` artifacts; the README links these as downloadable releases.

## Diagnostic logging

The extension creates an output channel named `jsx-spread-attributes` (visible in the VS Code Output panel). Refactor invocations, parse stats, and match decisions are logged there — useful when a refactor unexpectedly doesn't appear at the cursor.
