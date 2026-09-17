export const TOC_START = '<!-- toc -->';
export const TOC_END = '<!-- /toc -->';
const DEFAULT_SUMMARY = 'Table of contents';
const KNOWN_OPTIONS = ['collapsible', 'collapsed'];
const NUL = String.fromCharCode(0);
/** @type {Map<string, ReturnType<typeof analyse>>} */
const cache = new Map();
const LINK = /\[([^\]]*)\]\(#([^)\s]+)/g;

/**
 * The markdown with the toc between every `<!-- toc -->` and `<!-- /toc -->` pair regenerated.
 * @param {string} source
 * @returns {string}
 */
export function buildToc(source) {
  const { bom, lines, eol, headlines, markers } = analyse(source);
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
  return bom + out.join(eol);
}

/**
 * The toc block, markers included, for the headings below `fromLine`, empty when there is nothing to list.
 * @param {string} source
 * @param {number} [fromLine] zero based
 * @param {TocOptions} [options]
 * @returns {string}
 */
export function renderToc(source, fromLine = -1, options = {}) {
  const { eol, headlines } = analyse(source);
  const listed = headlines.filter((h) => h.line > fromLine);
  return listed.length === 0 ? '' : renderBlock(listed, formatMarker(options), options, eol);
}

/**
 * Every marker pair in document order, shared with later calls for the same source.
 * @param {string} source
 * @returns {Marker[]}
 */
export function findMarkers(source) {
  return analyse(source).markers;
}

/**
 * Every link to an anchor in the document, in order, shared with later calls for the same source.
 * @param {string} source
 * @returns {Anchor[]}
 */
export function findAnchors(source) {
  return analyse(source).anchors;
}

/**
 * The GitHub anchor slug of a heading's rendered text.
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
 * The text GitHub renders for a heading's inline markdown.
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
 * The lines and the scan of the source.
 * @param {string} source
 * @returns {{ bom: string, lines: string[], eol: string, headlines: Headline[], markers: Marker[], anchors: Anchor[] }}
 */
function analyse(source) {
  let result = cache.get(source);
  if (!result) {
    const { bom, lines, eol } = splitLines(source);
    result = { bom, lines, eol, ...scan(lines) };
    cache.clear();
    cache.set(source, result);
  }
  return result;
}

/**
 * The lines of the source, its byte order mark if any, and its line ending.
 * @param {string} source
 * @returns {{ bom: string, lines: string[], eol: string }}
 */
function splitLines(source) {
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
  return { bom, lines: source.slice(bom.length).split(/\r?\n/), eol: source.includes('\r\n') ? '\r\n' : '\n' };
}

/**
 * The headings, marker pairs and anchor links of the lines.
 * @param {string[]} lines
 * @returns {{ headlines: Headline[], markers: Marker[], anchors: Anchor[] }}
 */
function scan(lines) {
  /** @type {Headline[]} */
  const headlines = [];
  /** @type {Marker[]} */
  const markers = [];
  /** @type {Array<{ line: number, text: string, anchor: string }>} */
  const links = [];
  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {{ char: string, length: number } | null} */
  let fence = null;
  /** @type {Marker | null} */
  let open = null;
  let paragraph = false;
  let comment = false;

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
      paragraph = false;
      continue;
    }
    if (!paragraph && /^(?: {4}|\t)/.test(line)) continue;
    paragraph = line.trim() !== '';

    const { text: inline, restore } = protect(line);
    let visible = inline;
    if (comment) {
      const close = visible.indexOf('-->');
      if (close === -1) continue;
      visible = visible.slice(close + 3);
      comment = false;
    }
    visible = visible.replace(/<!--[\s\S]*?-->/g, '');
    const start = visible.indexOf('<!--');
    if (start !== -1) {
      visible = visible.slice(0, start);
      comment = true;
    }
    for (const [, tag, attributes] of visible.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
      for (const [, name, quoted, single] of attributes.matchAll(/(?:^|\s)(id|name)=(?:"([^"]*)"|'([^']*)')/g)) {
        if (name === 'id' || tag.toLowerCase() === 'a') ids.add(quoted ?? single);
      }
    }
    for (const [, text, anchor] of visible.matchAll(LINK)) links.push({ line: i, text: restore(text), anchor: restore(anchor) });

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
      headlines.push({ line: i, level: atx[1].length, markdown: atx[2], slug: '' });
      continue;
    }

    const setext = /^ {0,3}(=+|-+)\s*$/.exec(line);
    if (setext && i > 0 && isParagraphText(lines[i - 1])) {
      headlines.push({ line: i - 1, level: setext[1][0] === '=' ? 1 : 2, markdown: lines[i - 1].trim(), slug: '' });
    }
  }
  assignSlugs(headlines);
  return { headlines, markers, anchors: resolveAnchors(links, headlines, ids) };
}

/**
 * @param {Array<{ line: number, text: string, anchor: string }>} links
 * @param {Headline[]} headlines
 * @param {Set<string>} ids
 * @returns {Anchor[]}
 */
function resolveAnchors(links, headlines, ids) {
  const targets = new Set([...headlines.map((h) => h.slug), ...ids]);
  return links.map(({ line, text, anchor }) => {
    const decoded = decodeAnchor(anchor);
    if (targets.has(anchor) || targets.has(decoded)) return { line, text, anchor, valid: true };
    const candidates = new Set([slugify(headingText(decoded)), slugify(headingText(text))].filter((c) => targets.has(c)));
    if (candidates.size !== 1) return { line, text, anchor, valid: false };
    return { line, text, anchor, valid: false, suggestion: [...candidates][0] };
  });
}

/** @param {string} anchor */
function decodeAnchor(anchor) {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}

/**
 * Set the slug of every heading.
 * @param {Headline[]} headlines
 */
function assignSlugs(headlines) {
  /** @type {Record<string, number>} */
  const occurrences = {};
  for (const headline of headlines) {
    const base = slugify(headingText(headline.markdown));
    let slug = base;
    while (Object.hasOwn(occurrences, slug)) {
      occurrences[base]++;
      slug = `${base}-${occurrences[base]}`;
    }
    occurrences[slug] = 0;
    headline.slug = slug;
  }
}

/**
 * The toc block for the headings, between the start marker line and the end marker.
 * @param {Headline[]} headlines
 * @param {string} startLine
 * @param {TocOptions} options
 * @param {string} [eol]
 */
function renderBlock(headlines, startLine, options, eol = '\n') {
  let minLevel = Infinity;
  const tocLines = headlines.map(({ level, markdown, slug }) => {
    minLevel = Math.min(minLevel, level);
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
 * The options written on a start marker, with a problem when they cannot be used.
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
 * The start marker line for the options.
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
 * @returns {string[]}
 */
function formatAttributes(attributes) {
  return Object.entries(attributes).map(([name, value]) => `${name}="${value}"`);
}

/**
 * The link text used in the toc for a heading.
 * @param {string} markdown
 * @returns {string}
 */
function headingLabel(markdown) {
  const { text, restore } = protect(stripClosingHashes(markdown), { keepCodeSpans: true });
  return restore(stripLinks(text)).trim();
}

/**
 * The markdown with code spans and backslash escapes swapped for placeholders, and a function to put them back.
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
 * The code span content unpadded as CommonMark renders it.
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
 * The text with links, images and autolinks flattened to their text or url.
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
 * Options written on a start marker, each `true` or a summary text, and the other attributes for the summary element.
 * @typedef {{ collapsible?: true | string, collapsed?: true | string, attributes?: Record<string, string> }} TocOptions
 */

/**
 * A heading with its zero based line, level, inline markdown and GitHub slug.
 * @typedef {{ line: number, level: number, markdown: string, slug: string }} Headline
 */

/**
 * A link to an anchor with its zero based line, text, anchor as written, whether it has a target and, when it
 * has none and one heading clearly matches, a suggestion.
 * @typedef {{ line: number, text: string, anchor: string, valid: boolean, suggestion?: string }} Anchor
 */

/**
 * A marker pair as zero based lines, -1 for a missing side, with its options and a problem when they cannot be used.
 * @typedef {{ start: number, end: number, options: TocOptions, problem?: string }} Marker
 */
