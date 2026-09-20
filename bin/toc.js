#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { buildToc, findAnchors, findMarkers, renderToc } from '../index.js';

const PATTERN = /[*?[]/;

const USAGE = `Usage: toc [options] [file...]

Update the table of contents between every <!-- toc --> and <!-- /toc -->
pair in markdown files. Each pair lists the headings below its own start
marker. A file that does not exist or has no markers is skipped, and so
is a pair that is unbalanced, has a problem on its start marker, or has
no headings below it, each with a warning on stderr. Every link to an anchor, [text](#slug),
is checked against the headings and html ids in the file and a link
without a target gets a warning too.

Markers:
  <!-- toc -->                          plain list
  <!-- toc collapsible -->              list inside a <details> element, open
  <!-- toc collapsed -->                same, but closed until clicked
  <!-- toc collapsed="Contents" -->     either one with a custom summary text
  <!-- toc collapsed class="toc" -->    other name="value" pairs go on <summary>
  <!-- toc levels="2-3" -->             only these heading levels, also "2", "-3", "3-"
  <!-- /toc -->                         end of the block

Files are resolved against the current directory and default to
README.md. Several files can be given as separate arguments or comma
separated. An argument with *, ? or [ is a glob pattern, ** matches
subdirectories, node_modules is never entered. A pattern that matches
nothing is skipped with a warning, and so is every pattern on a Node
before 22, which has no fs.glob. A file is processed once, however many
arguments name or match it.

Options:
  -n, --dry-run  print the toc to stdout and report on stderr, write nothing.
                 Without markers every heading is listed so the block can be
                 pasted into the document
  -c, --check    exit with 1 when a link to an anchor has no target
  -s, --silent   skip the status lines and the skipped warnings, only missing
                 files, anchor warnings and errors are written
  -h, --help     show this help
`;

await main();

async function main() {
  const { files, help, unknown, ...flags } = parseArgs(process.argv.slice(2));

  if (unknown) {
    console.error(`Unknown option: ${unknown}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if (help) {
    console.log(USAGE);
    return;
  }

  const seen = new Set();
  for (const arg of files) {
    if (PATTERN.test(arg) && typeof fs.glob !== 'function') {
      console.error(`${arg}: glob patterns need Node 22 or later, skipped.`);
      continue;
    }
    const matches = await expand(arg);
    if (!matches.length) console.error(`${arg}: no matching file, skipped.`);
    for (const file of matches) {
      const key = resolve(file);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await processFile(file, flags);
      } catch (err) {
        if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
          console.error(`${file}: no such file, skipped.`);
          continue;
        }
        console.error(`${file}: ${/** @type {Error} */ (err).message}`);
        process.exitCode = 1;
      }
    }
  }
}

/**
 * Expand a glob pattern to the sorted matching files, a plain path is returned as is.
 * @param {string} arg
 * @returns {Promise<string[]>}
 */
async function expand(arg) {
  if (!PATTERN.test(arg)) return [arg];
  const matches = [];
  for await (const file of fs.glob(arg, { exclude: (path) => basename(path) === 'node_modules' })) matches.push(file);
  return matches.sort();
}

/**
 * Update the toc and check the anchors of one file, or report what would happen with `dryRun`.
 * @param {string} file
 * @param {{ dryRun: boolean, check: boolean, silent: boolean }} flags
 */
async function processFile(file, { dryRun, check, silent }) {
  const source = await fs.readFile(file, 'utf8');
  const status = silent ? noop : dryRun ? console.error : console.log;
  const warn = console.error;

  const regenerated = reportMarkers(file, source, dryRun, silent);
  let updated = source;
  if (regenerated.length) {
    updated = buildToc(source);
    if (updated === source) status(`${file}: TOC already up to date.`);
    else status(`${file}: ${dryRun ? 'would write' : 'wrote'} TOC.`);
  }

  for (const { line, anchor, valid, suggestion } of findAnchors(source)) {
    if (valid || regenerated.some(({ start, end }) => line >= start && line <= end)) continue;
    if (suggestion) warn(`${file}:${line + 1}: anchor #${anchor} has no target, did you mean #${suggestion}?`);
    else warn(`${file}:${line + 1}: anchor #${anchor} has no target.`);
    if (check) process.exitCode = 1;
  }

  if (!dryRun && updated !== source) await fs.writeFile(file, updated);
}

/**
 * @param {string} file
 * @param {string} source
 * @param {boolean} dryRun
 * @param {boolean} silent
 * @returns {Array<{ start: number, end: number }>}
 */
function reportMarkers(file, source, dryRun, silent) {
  const markers = findMarkers(source);
  const warn = silent ? noop : console.error;
  /** @type {Array<{ start: number, end: number }>} */
  const regenerated = [];

  if (markers.length === 0) {
    const toc = renderToc(source);
    if (dryRun && toc) console.log(toc);
    warn(`${file}: no TOC markers, skipped.`);
    return regenerated;
  }

  for (const { start, end, options, problem, warning } of markers) {
    if (start === -1) {
      warn(`${file}:${end + 1}: TOC end marker without start marker, skipped.`);
      continue;
    }
    if (warning) warn(`${file}:${start + 1}: ${warning}.`);
    const toc = renderToc(source, start, problem ? {} : options);
    if (dryRun && toc) console.log(toc);
    if (problem) warn(`${file}:${start + 1}: ${problem}, skipped.`);
    else if (end === -1) warn(`${file}:${start + 1}: TOC start marker without end marker, skipped.`);
    else if (!toc) warn(`${file}:${start + 1}: no headings below TOC start marker, skipped.`);
    else regenerated.push({ start, end });
  }
  return regenerated;
}

/**
 * @param {string[]} argv
 * @returns {{ files: string[], dryRun: boolean, check: boolean, silent: boolean, help: boolean, unknown?: string }}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const files = [];
  const flags = { dryRun: false, check: false, silent: false, help: false };
  for (const arg of argv) {
    if (arg === '-n' || arg === '--dry-run') flags.dryRun = true;
    else if (arg === '-c' || arg === '--check') flags.check = true;
    else if (arg === '-s' || arg === '--silent') flags.silent = true;
    else if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg.startsWith('-')) return { files, ...flags, unknown: arg };
    else files.push(...arg.split(',').filter(Boolean));
  }
  return { files: files.length ? files : ['README.md'], ...flags };
}

function noop() {}
