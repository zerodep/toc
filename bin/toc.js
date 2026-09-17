#!/usr/bin/env node
/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';

import { buildToc, findAnchors, findMarkers, renderToc } from '../index.js';

const USAGE = `Usage: toc [options] [file...]

Update the table of contents between every <!-- toc --> and <!-- /toc -->
pair in markdown files. Each pair lists the headings below its own start
marker. A file without markers is skipped, and so is a pair that is
unbalanced, has a problem on its start marker, or has no headings below
it, each with a warning on stderr. Every link to an anchor, [text](#slug),
is checked against the headings and html ids in the file and a link
without a target gets a warning too.

Markers:
  <!-- toc -->                          plain list
  <!-- toc collapsible -->              list inside a <details> element, open
  <!-- toc collapsed -->                same, but closed until clicked
  <!-- toc collapsed="Contents" -->     either one with a custom summary text
  <!-- toc collapsed class="toc" -->    other name="value" pairs go on <summary>
  <!-- /toc -->                         end of the block

Files are resolved against the current directory and default to
README.md. Several files can be given as separate arguments or comma
separated.

Options:
  -n, --dry-run  print the toc to stdout and report on stderr, write nothing.
                 Without markers every heading is listed so the block can be
                 pasted into the document
  -c, --check    exit with 1 when a link to an anchor has no target
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

  for (const file of files) {
    try {
      await processFile(file, flags);
    } catch (err) {
      console.error(`${file}: ${/** @type {Error} */ (err).message}`);
      process.exitCode = 1;
    }
  }
}

/**
 * Update the toc and check the anchors of one file, or report what would happen with `dryRun`.
 * @param {string} file
 * @param {{ dryRun: boolean, check: boolean }} flags
 */
async function processFile(file, { dryRun, check }) {
  const source = await readFile(file, 'utf8');
  const status = dryRun ? console.error : console.log;
  const warn = console.error;

  const regenerated = reportMarkers(file, source, dryRun);
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

  if (!dryRun && updated !== source) await writeFile(file, updated);
}

/**
 * @param {string} file
 * @param {string} source
 * @param {boolean} dryRun
 * @returns {Array<{ start: number, end: number }>}
 */
function reportMarkers(file, source, dryRun) {
  const markers = findMarkers(source);
  const warn = console.error;
  /** @type {Array<{ start: number, end: number }>} */
  const regenerated = [];

  if (markers.length === 0) {
    const toc = renderToc(source);
    if (dryRun && toc) console.log(toc);
    warn(`${file}: no TOC markers, skipped.`);
    return regenerated;
  }

  for (const { start, end, options, problem } of markers) {
    if (start === -1) {
      warn(`${file}:${end + 1}: TOC end marker without start marker, skipped.`);
      continue;
    }
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
 * @returns {{ files: string[], dryRun: boolean, check: boolean, help: boolean, unknown?: string }}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const files = [];
  const flags = { dryRun: false, check: false, help: false };
  for (const arg of argv) {
    if (arg === '-n' || arg === '--dry-run') flags.dryRun = true;
    else if (arg === '-c' || arg === '--check') flags.check = true;
    else if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg.startsWith('-')) return { files, ...flags, unknown: arg };
    else files.push(...arg.split(',').filter(Boolean));
  }
  return { files: files.length ? files : ['README.md'], ...flags };
}
