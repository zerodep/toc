#!/usr/bin/env node
/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';

import { buildToc, findMarkers, renderToc } from '../index.js';

const USAGE = `Usage: toc [options] [file...]

Update the table of contents between every <!-- toc --> and <!-- /toc -->
pair in markdown files. Each pair lists the headings below its own start
marker. A file without markers is skipped, and so is a pair that is
unbalanced, has a problem on its start marker, or has no headings below
it, each with a warning on stderr.

Markers:
  <!-- toc -->                          plain list
  <!-- toc collapsible -->              list inside a <details> element, open
  <!-- toc collapsed -->                same, but closed until clicked
  <!-- toc collapsed="Contents" -->     either one with a custom summary text
  <!-- toc collapsed class="toc" -->    other name="value" pairs go on <summary>
  <!-- /toc -->                         end of the block Files are resolved against the current directory and default to
README.md. Several files can be given as separate arguments or comma
separated.

Options:
  -n, --dry-run  print the toc to stdout and report on stderr, write nothing.
                 Without markers every heading is listed so the block can be
                 pasted into the document
  -h, --help     show this help
`;

await main();

async function main() {
  const { files, dryRun, help, unknown } = parseArgs(process.argv.slice(2));

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
      await processFile(file, dryRun);
    } catch (err) {
      console.error(`${file}: ${/** @type {Error} */ (err).message}`);
      process.exitCode = 1;
    }
  }
}

/**
 * Status lines go to stdout, warnings to stderr with the marker's line number. With `dryRun` the rendered toc
 * of every start marker goes to stdout instead of the file, so it can be piped, and the status line moves to
 * stderr. A start marker that will be skipped still gets its block printed, plain when its options are broken,
 * so the author sees the list either way.
 * @param {string} file
 * @param {boolean} dryRun
 */
async function processFile(file, dryRun) {
  const source = await readFile(file, 'utf8');
  const markers = findMarkers(source);
  const warn = console.error;

  if (markers.length === 0) {
    const toc = renderToc(source);
    if (dryRun && toc) console.log(toc);
    warn(`${file}: no TOC markers, skipped.`);
    return;
  }

  let updatable = 0;
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
    else updatable++;
  }
  if (updatable === 0) return;

  const updated = buildToc(source);
  if (updated === source) {
    (dryRun ? console.error : console.log)(`${file}: TOC already up to date.`);
  } else if (dryRun) {
    console.error(`${file}: would write TOC.`);
  } else {
    await writeFile(file, updated);
    console.log(`${file}: wrote TOC.`);
  }
}

/**
 * @param {string[]} argv
 * @returns {{ files: string[], dryRun: boolean, help: boolean, unknown?: string }}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const files = [];
  let dryRun = false;
  let help = false;
  for (const arg of argv) {
    if (arg === '-n' || arg === '--dry-run') dryRun = true;
    else if (arg === '-h' || arg === '--help') help = true;
    else if (arg.startsWith('-')) return { files, dryRun, help, unknown: arg };
    else files.push(...arg.split(',').filter(Boolean));
  }
  return { files: files.length ? files : ['README.md'], dryRun, help };
}
