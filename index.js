export const TOC_START = '<!-- toc -->';
export const TOC_END = '<!-- /toc -->';
const DEFAULT_SUMMARY = 'Table of contents';
const KNOWN_OPTIONS = ['collapsible', 'collapsed'];
const NUL = String.fromCharCode(0);

/**
 * Return the markdown with the toc between every `<!-- toc -->` and `<!-- /toc -->` pair regenerated. Each
 * pair lists every heading below its own start marker. A pair is left alone when it is unbalanced, has a
 * problem on its start marker, or has no headings below it, and nothing outside the pairs is ever touched.
 * The start marker line is kept as written, options included.
 * @param {string} source
 * @returns {string}
 */
export function buildToc(source) {
  const { lines, eol } = splitLines(source);
  const { headlines, markers } = scan(lines);
  /** @type {string[]} */
  const out = [];
  let cursor = 0;
  for (const { start, end, options, problem } of markers) {
    if (start === -1 || end === -1 || problem) continue;
    const listed = headlines.filter((h) => h.line > start);
    if (listed.length === 0) continue;
    out.push(...lines.slice(cursor, start), renderBlock(listed, lines[start], options, eol));
    cursor = end + 1;
  }
  out.push(...lines.slice(cursor));
  return out.join(eol);
}

/**
 * Return the toc block, markers included, for the headings below `fromLine`, by default every heading so the
 * block can be pasted into a document without markers. Returns an empty string when there is nothing to list.
 * @param {string} source
 * @param {number} [fromLine] zero based line number, typically the start marker's
 * @param {TocOptions} [options] rendered into the start marker, e.g. `{ collapsed: 'Contents' }`
 * @returns {string}
 */
export function renderToc(source, fromLine = -1, options = {}) {
  const { lines, eol } = splitLines(source);
  const listed = scan(lines).headlines.filter((h) => h.line > fromLine);
  return listed.length === 0 ? '' : renderBlock(listed, formatMarker(options), options, eol);
}

/**
 * Every marker pair in document order as zero based line numbers, outside fenced code blocks. A start marker
 * pairs with the first end marker after it. A missing side is -1: a start marker without an end marker, or an
 * end marker with no open start marker before it. `options` holds the recognised options written on the start
 * marker and `problem`, only present when there is one, says why the marker cannot be used.
 * @param {string} source
 * @returns {Marker[]}
 */
export function findMarkers(source) {
  return scan(splitLines(source).lines).markers;
}

/**
 * Slug a heading's rendered text the way github-slugger does: lowercase, drop everything that is not a
 * letter, number, mark, space, hyphen or underscore, then turn each space into a hyphen. Nothing is trimmed
 * or collapsed.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
    .replace(/ /g, '-');
}

/**
 * Reduce a heading's inline markdown to the text GitHub renders and slugs.
 * @param {string} markdown
 * @returns {string}
 */
export function headingText(markdown) {
  const { text, restore } = protect(stripClosingHashes(markdown));
  const rendered = stripLinks(text)
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1')
    .replace(/\*+(?=\S)|(?<=\S)\*+/g, '')
    .replace(/(?<![\p{L}\p{N}_])_+(?=\S)|(?<=\S)_+(?![\p{L}\p{N}_])/gu, '');
  return restore(rendered).trim();
}

/**
 * Split the source into lines and remember its line ending, CRLF when the source has any, so the toc is
 * written the way the rest of the file is and a Windows authored file does not end up with mixed endings.
 * @param {string} source
 * @returns {{ lines: string[], eol: string }}
 */
function splitLines(source) {
  return { lines: source.split(/\r?\n/), eol: source.includes('\r\n') ? '\r\n' : '\n' };
}

/**
 * Scan the lines for every marker pair and every ATX and setext heading, all outside fenced code blocks. A
 * marker is a line holding nothing but the comment, indented at most three spaces like a heading, since four
 * make an indented code block. A start marker, `<!-- toc -->` with optional options before the closing `-->`,
 * opens a pair that the first end marker after it closes; a start marker inside an open pair is content and an end marker outside a pair is
 * reported with start -1.
 * @param {string[]} lines
 * @returns {{ headlines: Array<{ line: number, level: number, markdown: string }>, markers: Marker[] }}
 */
function scan(lines) {
  /** @type {Array<{ line: number, level: number, markdown: string }>} */
  const headlines = [];
  /** @type {Marker[]} */
  const markers = [];
  /** @type {{ char: string, length: number } | null} */
  let fence = null;
  /** @type {Marker | null} */
  let open = null;

  for (const [i, line] of lines.entries()) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length && !fenceMatch[2].trim()) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch && !(fenceMatch[1][0] === '`' && fenceMatch[2].includes('`'))) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }

    const startMatch = /^ {0,3}<!--\s*toc(?:\s+(.*?))?\s*-->\s*$/.exec(line);
    if (startMatch) {
      if (!open) markers.push((open = { start: i, end: -1, ...parseOptions(startMatch[1]) }));
      continue;
    }
    if (/^ {0,3}<!--\s*\/toc\s*-->\s*$/.test(line)) {
      if (open) open.end = i;
      else markers.push({ start: -1, end: i, options: {} });
      open = null;
      continue;
    }

    const atx = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (atx) {
      headlines.push({ line: i, level: atx[1].length, markdown: atx[2] });
      continue;
    }

    const setext = /^ {0,3}(=+|-+)\s*$/.exec(line);
    if (setext && i > 0 && isParagraphText(lines[i - 1])) {
      headlines.push({ line: i - 1, level: setext[1][0] === '=' ? 1 : 2, markdown: lines[i - 1].trim() });
    }
  }
  return { headlines, markers };
}

/**
 * The toc block for the given headings, wrapped in the given start marker line and the end marker. Indentation
 * is relative to the shallowest level listed so far, so the list never starts indented, which markdown would
 * render flat anyway, and duplicate slugs get github style `-1`, `-2` suffixes. With
 * `collapsible` or `collapsed` the list goes inside a details element, open or closed to start with, blank
 * lines around it so it renders as markdown, and any other attributes from the marker on the summary element.
 * @param {Array<{ level: number, markdown: string }>} headlines
 * @param {string} startLine the start marker as written in the document
 * @param {TocOptions} options
 * @param {string} [eol] line ending, LF by default
 */
function renderBlock(headlines, startLine, options, eol = '\n') {
  /** @type {Record<string, number>} */
  const occurrences = {};
  let minLevel = Infinity;
  const tocLines = headlines.map(({ level, markdown }) => {
    minLevel = Math.min(minLevel, level);
    const base = slugify(headingText(markdown));
    let slug = base;
    while (Object.hasOwn(occurrences, slug)) {
      occurrences[base]++;
      slug = `${base}-${occurrences[base]}`;
    }
    occurrences[slug] = 0;
    return `${'  '.repeat(level - minLevel)}- [${headingLabel(markdown)}](#${slug})`;
  });
  const details = options.collapsible ?? options.collapsed;
  if (details === undefined) return [startLine, '', ...tocLines, '', TOC_END].join(eol);
  const summary = details === true ? DEFAULT_SUMMARY : details;
  const tag = options.collapsible === undefined ? '<details>' : '<details open>';
  const attrs = formatAttributes(options.attributes ?? {})
    .map((a) => ` ${a}`)
    .join('');
  return [startLine, tag, `<summary${attrs}>${summary}</summary>`, '', ...tocLines, '', '</details>', TOC_END].join(eol);
}

/**
 * Parse what is written on a start marker: the options as bare names (`collapsed`) or quoted values
 * (`collapsed="Contents"`), and any other well-formed `name="value"` as an attribute for the summary element.
 * Anything else, bare names that are not options, unquoted values, malformed names, is a problem, as is a
 * combination that makes no sense. A marker with a problem is never used.
 * @param {string | undefined} text
 * @returns {{ options: TocOptions, problem?: string }}
 */
function parseOptions(text) {
  /** @type {TocOptions} */
  const options = {};
  /** @type {Record<string, string>} */
  const attributes = {};
  /** @type {string[]} */
  const unknown = [];
  for (const [token, name, value] of (text ?? '').matchAll(/([^\s="]+)(?:="([^"]*)")?(?=\s|$)|\S+/g)) {
    if (name && KNOWN_OPTIONS.includes(name)) options[/** @type {'collapsible' | 'collapsed'} */ (name)] = value ?? true;
    else if (name && value !== undefined && /^[a-zA-Z][\w:.-]*$/.test(name)) attributes[name] = value;
    else unknown.push(token);
  }
  const names = Object.keys(attributes);
  if (names.length) options.attributes = attributes;
  if (unknown.length) return { options, problem: `unknown TOC option ${unknown.join(' ')}` };
  if (options.collapsible !== undefined && options.collapsed !== undefined) {
    return { options, problem: 'TOC options collapsible and collapsed exclude each other' };
  }
  if (names.length && options.collapsible === undefined && options.collapsed === undefined) {
    return { options, problem: `TOC attributes ${names.join(', ')} need collapsible or collapsed` };
  }
  return { options };
}

/**
 * The start marker line for the given options, the inverse of `parseOptions`: options first, then attributes.
 * @param {TocOptions} options
 */
function formatMarker(options) {
  const { attributes = {}, ...named } = options;
  const parts = [
    ...Object.entries(named).map(([name, value]) => (value === true ? name : `${name}="${value}"`)),
    ...formatAttributes(attributes),
  ];
  return parts.length ? `<!-- toc ${parts.join(' ')} -->` : TOC_START;
}

/**
 * @param {Record<string, string>} attributes
 * @returns {string[]} `name="value"` in the order given
 */
function formatAttributes(attributes) {
  return Object.entries(attributes).map(([name, value]) => `${name}="${value}"`);
}

/**
 * The label used in the toc: the heading's own markdown, except that links become their text since a link
 * cannot nest inside the toc link.
 * @param {string} markdown
 * @returns {string}
 */
function headingLabel(markdown) {
  const { text, restore } = protect(stripClosingHashes(markdown), { keepCodeSpans: true });
  return restore(stripLinks(text)).trim();
}

/**
 * Replace code spans (with their content, or the whole span when `keepCodeSpans` is set) and backslash escapes
 * (with the escaped character) by placeholders so the inline markdown passes leave them alone.
 * @param {string} markdown
 * @param {{ keepCodeSpans?: boolean }} [options]
 */
function protect(markdown, { keepCodeSpans = false } = {}) {
  /** @type {string[]} */
  const kept = [];
  /** @param {string} value */
  const keep = (value) => `${NUL}${kept.push(value) - 1}${NUL}`;
  const text = markdown
    .replace(/(`+)(.+?)\1(?!`)/g, (span, _ticks, code) => keep(keepCodeSpans ? span : unpadCodeSpan(code)))
    .replace(/\\([!-/:-@[-`{-~])/g, (_, char) => keep(char));
  return {
    text,
    /** @param {string} value */
    restore: (value) => value.replace(new RegExp(`${NUL}(\\d+)${NUL}`, 'g'), (_, i) => kept[Number(i)]),
  };
}

/**
 * Strip one leading and one trailing space from code span content when both are present and the content is
 * not only spaces, as CommonMark does.
 * @param {string} code
 */
function unpadCodeSpan(code) {
  if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') return code.slice(1, -1);
  return code;
}

/** @param {string} markdown */
function stripClosingHashes(markdown) {
  return markdown.replace(/(^|\s+)#+\s*$/, '');
}

/**
 * Links, images and reference links become their text, autolinks their url. Used for both the slug text and
 * the toc label since a link cannot nest inside the toc link.
 * @param {string} text
 */
function stripLinks(text) {
  return text
    .replace(/<(https?:\/\/[^>\s]+|mailto:[^>\s]+)>/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
}

/** @param {string} line */
function isParagraphText(line) {
  const trimmed = line.trim();
  return trimmed !== '' && !/^(#|>|[-*+]\s|\d+[.)]\s|\||[-=]+\s*$|```|~~~|<!--)/.test(trimmed);
}

/**
 * Options written on a start marker. `collapsible` wraps the list in a details element that starts open,
 * `collapsed` in one that starts closed. Each is `true` for the default summary "Table of contents" or a
 * string for a custom one. `attributes` are the other `name="value"` pairs on the marker, rendered on the
 * summary element in the order written, only present when there are any.
 * @typedef {{ collapsible?: true | string, collapsed?: true | string, attributes?: Record<string, string> }} TocOptions
 */

/**
 * A marker pair. `start` and `end` are zero based line numbers, -1 when that side is missing. `problem` is
 * only present when the start marker cannot be used: an unknown option or an impossible combination.
 * @typedef {{ start: number, end: number, options: TocOptions, problem?: string }} Marker
 */
