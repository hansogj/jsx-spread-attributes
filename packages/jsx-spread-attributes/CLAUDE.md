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

## Releasing & publishing

**Publish by uploading the VSIX in the browser. Do not use `vsce publish`.** The CLI route was tried exhaustively in 0.1.1 and is a dead end for this project:

- The publisher `HansOleGjerdrum` is owned by `murdrejg@gmail.com`, which has no Azure subscription. PAT generation requires an Azure DevOps organization, which requires an Azure subscription, which requires creating one (free tier exists but needs identity verification). `--azure-credential` hangs silently for the same reason — `DefaultAzureCredential` can't acquire a Marketplace-scoped token without a subscription.
- The Systek email `hans.ole.gjerdrum@systek.no` cannot be added as a co-publisher; Marketplace returns "Invalid domain" because `systek.no` is Google Workspace, not Entra ID.

Procedure:

1. Bump `version` in `package.json`, add a CHANGELOG entry, commit, tag `vX.Y.Z`, push.
2. `pnpm run vsix:package` to produce `jsx-spread-attributes-X.Y.Z.vsix` at the repo root.
3. Copy the VSIX into `downloads/` and commit it (matches the `feat(downloads): added latest downloadable version` pattern).
4. Sign into https://marketplace.visualstudio.com/manage/publishers/HansOleGjerdrum as `murdrejg@gmail.com`.
5. On the `jsx-spread-attributes` row, open the "..." / actions menu, choose **Update** (or use the upload icon), and upload the VSIX from `downloads/`. Marketplace validates and publishes.

If `pnpm run vsix:package` fails with TS errors about JSX in `dist/tmp.tsx` or similar, delete that scratch file — it's leftover from F5 dev-host testing inside the gitignored build dir, and ts-loader's full-project type-check picks it up. (`tsconfig.json` now has `"jsx": "react"` which mitigates this for valid JSX scratch files, but stray files in `dist/` are still better deleted.)
