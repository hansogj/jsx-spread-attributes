# Change Log

All notable changes to the "concise-arrow" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.1.0]

- Initial release.
- Refactor: `Remove braces from arrow function` — converts `() => { stmt; }` to `() => stmt` for both `ExpressionStatement` and `ReturnStatement` bodies. Fills the gap left by `tsserver`, which only handles the `ReturnStatement` case.
- Refactor: `Add braces (no return)` — converts `() => expr` to `() => { expr; }`. The return-preserving variant `() => { return expr; }` is already provided by `tsserver` and is intentionally not duplicated here.
