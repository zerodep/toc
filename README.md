# @0dep/toc

[![Build](https://github.com/zerodep/toc/actions/workflows/build.yaml/badge.svg)](https://github.com/zerodep/toc/actions/workflows/build.yaml)[![Build (Windows)](https://github.com/zerodep/toc/actions/workflows/build-windows.yaml/badge.svg)](https://github.com/zerodep/toc/actions/workflows/build-windows.yaml)[![Coverage Status](https://coveralls.io/repos/github/zerodep/toc/badge.svg?branch=main)](https://coveralls.io/github/zerodep/toc?branch=main)

Generate a GitHub flavoured table of contents for markdown files. No dependencies, ESM and CommonJS. The library is string in, string out and runs in the browser too, the `toc` bin needs Node 20 or later.

The toc is written between `<!-- toc -->` and `<!-- /toc -->` markers, and only there. Nothing outside the markers is ever touched, nothing is inserted or guessed. Slugs match GitHub's anchors.

<!-- toc -->

- [Install](#install)
- [Markers](#markers)
  - [Several tocs in one document](#several-tocs-in-one-document)
  - [Options](#options)
  - [What is left alone](#what-is-left-alone)
- [CLI](#cli)
  - [Options](#options-1)
  - [Output and exit code](#output-and-exit-code)
  - [Dry run](#dry-run)
  - [With prettier](#with-prettier)
- [API](#api)
  - [`buildToc(source)`](#buildtocsource)
  - [`renderToc(source[, fromLine[, options]])`](#rendertocsource-fromline-options)
  - [`findMarkers(source)`](#findmarkerssource)
  - [`slugify(text)`](#slugifytext)
  - [`headingText(markdown)`](#headingtextmarkdown)
  - [`TOC_START` and `TOC_END`](#toc_start-and-toc_end)
- [Headings](#headings)
  - [What is listed](#what-is-listed)
  - [Labels](#labels)
  - [Slugs](#slugs)
- [License](#license)

<!-- /toc -->

## Install

```sh
npm install --save-dev @0dep/toc
```

## Markers

Put the pair where the toc should go, on their own lines. Every heading below the start marker is listed, nothing above it is, so the document title stays out of the toc when the markers sit under it.

```markdown
# My project

<!-- toc -->
<!-- /toc -->

## Install

## Usage
```

becomes

```markdown
# My project

<!-- toc -->

- [Install](#install)
- [Usage](#usage)

<!-- /toc -->

## Install

## Usage
```

Running it again replaces whatever is between the markers with a fresh list, so the toc can be regenerated any number of times. A file with CRLF line endings keeps them, the toc is written with the same line ending as the rest of the file.

### Several tocs in one document

A document can have any number of marker pairs, for example a full toc at the top and one per section. Each pair lists every heading below its own start marker, and a later pair never shortens an earlier toc.

```markdown
# My project

<!-- toc -->
<!-- /toc -->

## API

<!-- toc -->
<!-- /toc -->

### get

### set

## License
```

The top toc lists API, get, set and License. The toc under API lists get, set and License.

### Options

GitHub and most other renderers support the html details element in markdown. Ask for it on the start marker and the list is wrapped in one. `collapsible` starts open and can be folded away, `collapsed` starts folded until the reader clicks the summary. This README has a `collapsed` one under [API](#api) and a `collapsible` one under [Headings](#headings).

```markdown
<!-- toc collapsed -->
<!-- /toc -->
```

becomes

```markdown
<!-- toc collapsed -->
<details>
<summary>Table of contents</summary>

- [Install](#install)
- [Usage](#usage)

</details>
<!-- /toc -->
```

Both take a summary text, `<!-- toc collapsible="Contents" -->` or `<!-- toc collapsed="Contents" -->`. Any other `name="value"` pair on the start marker is put on the summary element, in the order written:

```markdown
<!-- toc collapsed="Contents" title="Click to expand" style="font-weight: bold" -->
<details>
<summary title="Click to expand" style="font-weight: bold">Contents</summary>

- [Install](#install)

</details>
<!-- /toc -->
```

Renderers sanitise html, so check what yours keeps. GitHub drops `style`, `class` and `id` but keeps `title`, `dir`, `lang`, `role` and `aria-*` attributes, so in the example above only the `title` survives there. The start marker itself is kept exactly as written, and spacing inside the comment does not matter.

Anything on the start marker that is not one of the two options or a well-formed attribute makes the pair skip with a warning rather than guess: a bare name other than the two options, so a typo like `collapsable` is caught, an unquoted value like `collapsed=yes`, both options at once, or attributes without an option to give them a summary element.

### What is left alone

- A file without markers
- A start marker without an end marker after it
- An end marker with no open start marker before it
- A pair with no headings below its start marker, since a toc that lists nothing is more likely a misplaced marker than an empty document
- A pair whose start marker has a problem: an unknown option, both `collapsible` and `collapsed`, or attributes without either
- Markers indented four spaces or more, that is an indented code block
- Markers and headings inside fenced code blocks, so this README can show marker examples. A marker in inline code or in the middle of a sentence is not a marker either, only a line holding nothing but the comment

A start marker pairs with the first end marker after it, a second start marker inside an open pair is treated as content and replaced with the rest of the block. The CLI reports every skipped file and pair with a warning, see below.

This README has two headings named Options, the one above and the one under CLI. The second one is linked as `#options-1`, the way GitHub numbers duplicate anchors.

## CLI

```sh
npx toc                        # updates README.md in the current directory
npx toc docs/a.md docs/b.md    # several files
npx toc docs/a.md,docs/b.md    # comma separated works too
npx toc --dry-run README.md    # print the toc, write nothing
npx toc --help
```

Paths are resolved against the current directory.

### Options

| Option          | Effect                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `-n, --dry-run` | Print the toc of every pair to stdout and the status to stderr, write nothing |
| `-h, --help`    | Show usage                                                                    |

### Output and exit code

One status line per file on stdout, and one warning per skipped file or pair on stderr with the marker's line number so it can be opened from a terminal.

| Message                                                                           | Stream | Meaning                                              |
| --------------------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| `README.md: wrote TOC.`                                                           | stdout | At least one pair changed and the file was written   |
| `README.md: TOC already up to date.`                                              | stdout | Every updatable pair was already correct             |
| `README.md: no TOC markers, skipped.`                                             | stderr | The file has no markers                              |
| `README.md:3: TOC start marker without end marker, skipped.`                      | stderr | Unbalanced pair                                      |
| `README.md:3: TOC end marker without start marker, skipped.`                      | stderr | Unbalanced pair                                      |
| `README.md:3: no headings below TOC start marker, skipped.`                       | stderr | Nothing to list for that pair                        |
| `README.md:3: unknown TOC option foo, skipped.`                                   | stderr | The start marker has something that is not an option |
| `README.md:3: TOC options collapsible and collapsed exclude each other, skipped.` | stderr | Pick one                                             |
| `README.md:3: TOC attributes style need collapsible or collapsed, skipped.`       | stderr | There is no summary element to put them on           |
| `README.md: ENOENT: no such file or directory, ...`                               | stderr | The file could not be read or written                |

The exit code is 1 when a file could not be read or written or when an option is not recognised, otherwise 0. Skipped files and pairs do not affect the exit code.

### Dry run

With `--dry-run` nothing is written. The rendered block of every start marker goes to stdout so it can be piped or redirected, and the status line and warnings go to stderr. A start marker that would be skipped, unbalanced or with a problem, still gets its block printed, plain when its options are broken, next to the warning. A file without markers gets a block with every heading, so the output can be pasted into the document as a starting point.

```sh
npx toc --dry-run docs/new.md > toc.md
```

```text
docs/new.md: no TOC markers, skipped.
```

### With prettier

The generated block is written the way prettier formats markdown, so the two do not fight: `-` bullets, two spaces per nesting level, a blank line before and after the list, and html on lines of its own. Running `prettier --write` over a generated toc changes nothing, and running `toc` over a prettier formatted toc changes nothing either. This README passes both.

Run `toc` before `prettier --check` so a stale toc is regenerated rather than reported as a formatting error. The order does not matter for the content: prettier leaves headings as written, setext underlines and closing hashes included, and it never breaks a line inside a link, so toc entries survive even `proseWrap: "always"`.

To regenerate the toc and format the rest of the file in one go, let a `posttoc` script run prettier with `--write` after `toc`. Prettier rewrites the prose and leaves the generated block as it is, so a second `toc` run reports the file up to date:

```json
{
  "scripts": {
    "toc": "toc README.md",
    "posttoc": "prettier --write README.md"
  }
}
```

## API

<!-- toc collapsed="Jump to" -->
<details>
<summary>Jump to</summary>

- [`buildToc(source)`](#buildtocsource)
- [`renderToc(source[, fromLine[, options]])`](#rendertocsource-fromline-options)
- [`findMarkers(source)`](#findmarkerssource)
- [`slugify(text)`](#slugifytext)
- [`headingText(markdown)`](#headingtextmarkdown)
- [`TOC_START` and `TOC_END`](#toc_start-and-toc_end)
- [Headings](#headings)
  - [What is listed](#what-is-listed)
  - [Labels](#labels)
  - [Slugs](#slugs)
- [License](#license)

</details>
<!-- /toc -->

```javascript
import { buildToc, renderToc, findMarkers, slugify, headingText, TOC_START, TOC_END } from '@0dep/toc';
```

CommonJS works the same way with `require('@0dep/toc')`.

### `buildToc(source)`

Returns the markdown `source` with the toc between every marker pair regenerated. A pair that is unbalanced, has a problem on its start marker, or has no headings below it is left alone, and the source is returned unchanged when nothing is updated. The start marker line is kept as written.

```javascript
import { buildToc } from '@0dep/toc';

const md = buildToc('# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## Install\n\n## Usage `api`\n');
console.log(md);
```

```text
# Title

<!-- toc -->

- [Install](#install)
- [Usage `api`](#usage-api)

<!-- /toc -->

## Install

## Usage `api`
```

### `renderToc(source[, fromLine[, options]])`

Returns the toc block, markers included, for the headings below the zero based line `fromLine`, typically a start marker's line. By default every heading is listed. Returns an empty string when there is nothing to list. `options` are rendered into the start marker and the block, `{ collapsible: true }`, `{ collapsed: 'Contents', attributes: { class: 'toc' } }` and so on.

```javascript
import { renderToc } from '@0dep/toc';

console.log(renderToc('# Title\n\n## Install\n\n### From npm\n'));
```

```text
<!-- toc -->

- [Title](#title)
  - [Install](#install)
    - [From npm](#from-npm)

<!-- /toc -->
```

### `findMarkers(source)`

Returns every marker pair in document order as `{ start, end, options }`, zero based line numbers outside fenced code blocks and the recognised options written on the start marker. A start marker pairs with the first end marker after it. A missing side is `-1`, a start marker without an end marker or an end marker with no open start before it. `options.attributes` holds the other `name="value"` pairs, when there are any. When the start marker cannot be used, `problem` says why and is otherwise absent.

```javascript
import { findMarkers } from '@0dep/toc';

console.log(findMarkers('# Title\n\n<!-- toc collapsed -->\n<!-- /toc -->\n\n## A\n\n<!-- toc foo -->\n'));
```

```text
[
  { start: 2, end: 3, options: { collapsed: true } },
  { start: 7, end: -1, options: {}, problem: 'unknown TOC option foo' }
]
```

### `slugify(text)`

The github-slugger algorithm: lowercase, drop everything that is not a letter, number, mark, space, hyphen or underscore, then turn spaces into hyphens. Nothing is trimmed or collapsed. Duplicate slugs in one toc get `-1`, `-2` and so on, like GitHub.

```javascript
import { slugify } from '@0dep/toc';

console.log(slugify('Usage `api`'), slugify('Ändra värde 2 gånger'));
```

```text
usage-api ändra-värde-2-gånger
```

### `headingText(markdown)`

Reduces a heading's inline markdown to the text GitHub renders and slugs: links and images become their text, emphasis, strikethrough and html tags are removed, autolinks become their url, code span content is kept without the backticks and backslash escapes are resolved.

```javascript
import { headingText } from '@0dep/toc';

console.log(headingText('Use `foo()` with [**bold**](https://example.com) \\*text\\*'));
```

```text
Use foo() with bold *text*
```

### `TOC_START` and `TOC_END`

The marker strings, `<!-- toc -->` and `<!-- /toc -->`, for code that wants to look for or insert them.

## Headings

<!-- toc collapsible="In this section and below" -->
<details open>
<summary>In this section and below</summary>

- [What is listed](#what-is-listed)
- [Labels](#labels)
- [Slugs](#slugs)
- [License](#license)

</details>
<!-- /toc -->

### What is listed

- ATX headings, `## Heading`, with up to three leading spaces and a space after the hashes, and setext headings underlined with `===` or `---`
- Every level, 1 through 6, below the start marker. Nesting is relative to the shallowest level listed so far, so a toc under a level 2 heading that lists level 3 headings starts flush left, and the level 2 headings that follow join them at the top level
- Not headings inside fenced code blocks, backtick or tilde
- Not a `---` line under a list item, a table row or a blank line, which is a thematic break and not a setext heading

### Labels

The link text is the heading's own markdown, so inline code and emphasis are kept, with two changes:

- Links and images become their text and autolinks their url, since a link cannot nest inside the toc link
- Optional closing hashes, `## Heading ##`, are stripped

### Slugs

Slugs are built from the rendered heading text with the same algorithm as GitHub, so the anchors work on github.com and in every renderer that follows it. See `slugify` and `headingText` above.

## License

MIT
