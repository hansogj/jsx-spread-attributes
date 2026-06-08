# Change Log

All notable changes to the "jsx-spread-attributes" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.1.1]

- Convert-to-spread now emits shorthand for `attr={attr}` (key matches identifier value) and reorders the resulting object so shorthand properties come first.
- Convert-from-spread now restores shorthand `{ c }` as `c={c}` instead of the lossy `<C c />` (which previously meant `c={true}`). Genuine `{ c: true }` still emits the bare attribute.

## [0.1.0]

- Initial release