# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@0dep/toc` generates a GitHub flavoured table of contents for markdown files. Zero runtime dependencies, published as dual ESM/CJS with generated TypeScript declarations. All runtime code is in one file, `index.js`, which is pure string in, string out with no Node imports so it runs in a browser too, plus the thin ESM CLI in `bin/toc.js` which owns all file IO. Node 20+ for the bin, `.nvmrc` says 22.

## Non-negotiables

- **Never commit.** Leave changes in the working tree, the maintainer reviews and commits.
- **Test-first.** Bug fixes and behaviour changes start with a failing mocha test in `test/*-test.js` before `index.js` is touched. Plain mocha + chai `expect`, no BDD DSL.
- **No dependencies.** Devdependencies only. The whole point of the package is that it replaces `markdown-toc` and `github-slugger` without pulling anything in.
- **`index.js` stays web friendly.** No `node:` imports, no `process`, no filesystem. Anything that reads or writes a file belongs in `bin/toc.js`. `test/exports-test.js` asserts the export list, that `index.cjs` exports the same, and that neither `index.js` nor `index.cjs` imports a `node:` module. `eslint.config.js` gives `index.js` its own block with no node globals, so a stray `process` or `Buffer` fails `no-undef`.
- **Never touch a document outside the markers.** `buildToc` only rewrites the lines between each `<!-- toc -->` and the `<!-- /toc -->` after it, and only when headings follow that start marker. A document can have several pairs and each lists everything below its own start marker (rule B: a later start marker never cuts an earlier toc short). Unbalanced pairs, pairs with a problem on the start marker, or pairs with nothing to list, are left alone. No insertion, no guessing. New marker options go in `KNOWN_OPTIONS`, the `TocOptions` typedef, `parseOptions`/`formatMarker`, `renderBlock`, the bin usage text and the README, with tests for parsing, rendering, idempotence and the dry run output. The bin warns on stderr with `file:line:` and skips. Dry run still prints a block per start marker, including skipped ones (plain when the options are broken), or one from every heading when there are no markers, so the author can paste it in.
- **Prettier and the toc must agree.** The generated block is prettier clean by construction: `-` bullets, two space nesting, blank lines around the list and around the details html, running minimum indentation so a list never starts indented. If a change to `renderBlock` makes `prettier --check README.md` fail after `npm run toc`, the change is wrong, not the README. Verified with prettier 3: it keeps setext headings and closing hashes as written and never breaks inside a link, so toc lines survive `proseWrap: always` too. Verify such claims by running prettier on a snippet before writing them in the README.
- **The README eats its own dog food.** `npm run toc` regenerates the tocs in `README.md`, a plain one at the top, a `collapsed` one under API and a `collapsible` one under Headings, and the two headings named Options are there on purpose to show the `#options-1` dedupe. Summary attributes are not dogfooded in the README since GitHub strips them, the fenced example under Options documents them, and runs in `pretest`, so `npm test` must leave the README tocs up to date and the README test passes. A stale or misplaced README toc is a bug in `index.js`, not in the README.

## Commands

- `npm test` runs `toc` and `dist` first (`pretest`), then mocha, then `posttest` runs lint, `tsc` and `test:md`, so `npm test` is the full pre-commit gate. `toc` goes before mocha because `test/cli-test.js` dry-runs the real `README.md` and asserts it is up to date and that its two blocks equal the dry run output, and `dist` because `test/exports-test.js` loads `index.cjs` and checks it matches `index.js`. If you run `npx mocha` directly after editing `index.js` or `README.md`, run `npm run toc && npm run dist` first.
- `npm run toc` updates the toc in `README.md` via the bin, then `posttoc` runs `prettier --write README.md`, which is the recipe the README documents under With prettier.
- `npm run lint` eslint (cached) + prettier check (cached). `npx prettier . --write` fixes formatting.
- `npm run tsc` runs `tsc -p test`, which type-checks `index.js`, `bin/`, and the tests with `checkJs`. Keep it clean: annotate with JSDoc, cast caught errors with `/** @type {Error} */ (err)`.
- `npm run dist` rollup bundles `index.js` to `index.cjs` and `dts-buddy` regenerates `types/index.d.ts` from JSDoc. Both outputs are committed. Never hand-edit `types/index.d.ts` or `index.cjs`.
- `npm run test:md` runs `texample`, which executes every ` ```javascript ` block in `README.md` against the local package, so README examples must be runnable and must never write the README mid-run. Runs last in `posttest`.
- `npm run cov:html` / `npm run test:lcov` coverage via c8 over `index.js` and `bin/`.
- Single test: `npx mocha --grep 'fenced'` or `npx mocha test/toc-test.js`.
- Try the CLI: `node bin/toc.js README.md` or `node bin/toc.js a.md,b.md c.md`. Paths resolve against cwd. The bin imports `index.js`, so edits are visible to the CLI at once, no build step.
- TypeScript is pinned to `^6`. v7 breaks `dts-buddy`.

## Architecture

Everything is in `index.js`:

- `slugify(text)` is the github-slugger algorithm: lowercase, drop everything but letters, numbers, marks, space, hyphen, underscore, then space to hyphen. Nothing is trimmed or collapsed, that matches GitHub.
- `headingText(markdown)` reduces heading markdown to the text GitHub renders, which is what gets slugged. `headingLabel` (private) is the toc link text: same but keeps code spans and emphasis, only links, images and autolinks are flattened (`stripLinks`, shared with `headingText`) since a link cannot nest in a link and CommonMark gives an inner autolink precedence over the outer link.
- Both go through `protect()`, which swaps code spans and backslash escapes for NUL-delimited placeholders so the emphasis/html/link regexes leave them alone, then `restore()` puts them back. Code span content is unpadded by one space per side like CommonMark (`unpadCodeSpan`).
- `splitLines(source)` splits on `\r?\n` and remembers the line ending (CRLF when the source has any) so `buildToc`, `renderToc` and `renderBlock` join with the file's own ending. Never `split('\n')` on the source directly.
- `scan(lines)` is the single line walk. It tracks fenced code blocks (backtick or tilde, closing fence must use the same char and be at least as long, a backtick info string containing a backtick is not a fence) and, outside fences, records every ATX and setext heading with its line number plus every marker pair: a start opens a pair, the first end after it closes it, a start inside an open pair is content, an end outside a pair is `{ start: -1, end }`. The start marker is matched by regex, `<!-- toc ... -->`, indented at most three spaces, and its options are parsed by `parseOptions` into `{ options, problem? }`: bare names or `name="value"` for the two options, any other well-formed `name="value"` goes to `options.attributes` for the summary element (order preserved, `formatAttributes` renders them), anything else or an impossible combination (`collapsible` with `collapsed`, attributes without either) sets `problem`, a sentence the bin prints verbatim. Bare names that are not options stay unknown on purpose, so typos are caught. `KNOWN_OPTIONS` is the single list of accepted option names. Markers and headings inside fences are ignored.
- `renderBlock(headlines, startLine, options)` (private) builds the block: indent relative to the shallowest level listed so far (a running minimum, so the list never starts indented, which prettier would flatten and markdown renders flat anyway), github style `-1`, `-2` dedupe of slugs, the start marker line as written in the document and `TOC_END` around it. With `collapsible` (`<details open>`) or `collapsed` (`<details>`) the list goes inside a details element with a summary and blank lines around it, which GitHub needs to render the list as markdown. `formatMarker(options)` is the inverse of `parseOptions`, used by `renderToc` which has no source marker line.
- `buildToc(source)` walks the pairs with a cursor and replaces each complete pair that has headings below its start with the rendered block. Unbalanced pairs, pairs with a problem, and empty pairs are copied through untouched.
- `renderToc(source, fromLine = -1, options = {})` renders the headings after `fromLine`, so all headings by default, `''` when nothing to list. `findMarkers(source)` returns the pairs so the bin can name the exact problem and line.

`bin/toc.js` is ESM and imports `buildToc`, `renderToc` and `findMarkers` from `index.js`. The rollup output `index.cjs` is for `require` consumers only and is exercised by `test/exports-test.js`. It reads and writes the files itself, the library never touches the filesystem. It accepts files as separate args or comma separated, defaults to `README.md`, takes `-n`/`--dry-run` (prints the toc block via `renderToc` to stdout and the status or warning to stderr so stdout is pipeable, writes nothing) and `-h`/`--help`, rejects any other dash option with usage on stderr and exit code 1, prints one line per file, sets `process.exitCode = 1` on any failure but keeps going. `parseArgs` is hand rolled, no `util.parseArgs`, so behaviour is identical across Node versions. eslint bans `process.exit` and `console` is a warning, the bin opts out of `no-console` explicitly.

## Conventions

- **Windows is a CI target.** `.github/workflows/build-windows.yaml` runs `npm run dist`, `npx mocha` and `npm run test:md` (texample over the README) on windows-latest, best effort. `.gitattributes` forces LF on checkout so the README test, which asserts the README is byte for byte up to date, holds there too. Use `fileURLToPath`, never `URL.pathname`, and keep the CRLF test in `test/toc-test.js` green.

- **Order by importance.** In `index.js` the exported functions come first, most important first (`buildToc`, `renderToc`, `findMarkers`, `slugify`, `headingText`), and private helpers follow in the order they are used. Function declarations hoist, so never reorder to satisfy "define before use". Keep this when adding code.

- Tests import the package by name, `import { buildToc } from '@0dep/toc'`, which Node and tsc resolve through the `exports` map in `package.json` to `index.js` and `types/index.d.ts`. Never import `../index.js` from tests.
- `.mocharc.json` registers `chai/register-expect.js`, so `expect` is a global in tests, declared for tsc in `test/globals.d.ts`. Tests relax `no-unused-expressions`.
- `test/tsconfig.json` extends the root config with `noEmit`, `rootDir: '..'`, and the `node`, `chai`, `mocha` types. The root `tsconfig.json` is what `dts-buddy` reads.
- CLI tests run the bin in a temp dir via `execFile(process.execPath, …)`. Use `fileURLToPath` for the bin path, the Windows CI job will break on `URL.pathname`.
- `tsconfig.json` has `checkJs` + `strict` (with `strictNullChecks: false`) over `index.js` and `bin/`. JSDoc is the type source, `dts-buddy` reads the `exports` map in `package.json` to produce `types/index.d.ts`.
- Rollup has nothing external, output is `index.cjs` with named exports. `require('@0dep/toc')` gives `{ buildToc, renderToc, findMarkers, slugify, headingText, TOC_START, TOC_END }`.
- `CHANGELOG.md` follows the peer projects: `## vX.Y.Z - YYYY-MM-DD` sections under `[Unreleased]`, one bullet per change.
