# Changelog

All notable changes to this project will be documented in this file.

## v1.1.0 - 2026-09-17

- duplicate slugs are numbered over the whole document, headings above the start marker included, the way GitHub does. A toc under a heading that shares its name with a later heading used to link the later one without the `-1`
- `findAnchors(source)` lists every link to an anchor in the document with whether it has a target, and a suggestion when a heading obviously matches
- the last source and its scan are cached, so the bin walks a file once instead of once per call
- the bin checks every link to an anchor outside the regenerated pairs and warns about the ones without a target, `-c`/`--check` makes them set exit code 1
- a byte order mark at the start of the file is ignored and kept, a heading or start marker on the first line used to be missed

## v1.0.1 - 2026-09-12

- `updateToc` is removed and the library no longer imports anything from Node, so it runs in the browser too. Reading and writing files is the `toc` bin's job, use `buildToc` with your own IO
- the bin is ESM, `bin/toc.js`, and imports `index.js` directly

## v1.0.0 - 2026-09-12

- provenance release

## v0.0.1 - 2026-09-12

- initial release: `buildToc`, `updateToc`, `slugify`, `headingText`, and the `toc` bin
