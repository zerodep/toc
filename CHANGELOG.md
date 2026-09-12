# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- `updateToc` is removed and the library no longer imports anything from Node, so it runs in the browser too. Reading and writing files is the `toc` bin's job, use `buildToc` with your own IO
- the bin is ESM, `bin/toc.js`, and imports `index.js` directly

## v0.1.0 - 2026-09-11

- initial release: `buildToc`, `updateToc`, `slugify`, `headingText`, and the `toc` bin
