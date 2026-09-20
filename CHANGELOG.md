# Changelog

All notable changes to this project will be documented in this file.

<!-- toc levels="2" -->

- [v2.1.0 - 2026-09-20](#v210---2026-09-20)
- [v2.0.0 - 2026-09-18](#v200---2026-09-18)
- [v1.1.0 - 2026-09-17](#v110---2026-09-17)
- [v1.0.1 - 2026-09-12](#v101---2026-09-12)
- [v1.0.0 - 2026-09-12](#v100---2026-09-12)
- [v0.0.1 - 2026-09-12](#v001---2026-09-12)

<!-- /toc -->

## v2.1.0 - 2026-09-20

- Node 20.19 or later again. The bin looks `fs.glob` up only when an argument is a glob pattern and warns and skips the pattern on a Node without it, so plain file arguments and `require('@0dep/toc')` work on Node 20.19

## v2.0.0 - 2026-09-18

### Breaking

- Node 22.12 or later. The bin expands glob patterns with `fs.promises.glob`, and `require('@0dep/toc')` loads `index.js` itself, so the CommonJS bundle `index.cjs` is gone
- `types/index.d.ts` is emitted by `tsc` as a plain module declaration instead of the `declare module '@0dep/toc'` block dts-buddy wrote, with a declaration map back to `index.js`

### Added

- `levels="2"`, `levels="2-3"`, `levels="-3"` or `levels="3-"` on the start marker limits the toc to those heading levels, so a changelog can list its versions alone. A broken value is ignored with a warning, `findMarkers` reports it as `warning`. `renderToc` takes `{ levels: '2-3' }`
- an argument with `*`, `?` or `[` is a glob pattern, `**` matches subdirectories and `node_modules` is never entered, so `toc 'docs/**/*.md'` works the same in an npm script on Windows as on macOS and Linux. A pattern that matches nothing is skipped with a warning, and a file is processed once however many arguments name or match it
- `-s`/`--silent` drops the status lines and the skipped warnings from the bin, so only anchor warnings and errors are written
- a file that does not exist is skipped with a warning and no longer sets the exit code, like a file without markers. `--silent` keeps that warning

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
