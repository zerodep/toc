/**
 * The markdown with the toc between every `<!-- toc -->` and `<!-- /toc -->` pair regenerated.
 * @param {string} source
 * @returns {string}
 */
export function buildToc(source: string): string;
/**
 * The toc block, markers included, for the headings below `fromLine`, empty when there is nothing to list.
 * @param {string} source
 * @param {number} [fromLine] zero based
 * @param {TocOptions} [options]
 * @returns {string}
 */
export function renderToc(source: string, fromLine?: number, options?: TocOptions): string;
/**
 * Every marker pair in document order, shared with later calls for the same source.
 * @param {string} source
 * @returns {Marker[]}
 */
export function findMarkers(source: string): Marker[];
/**
 * Every link to an anchor in the document, in order, shared with later calls for the same source.
 * @param {string} source
 * @returns {Anchor[]}
 */
export function findAnchors(source: string): Anchor[];
/**
 * The GitHub anchor slug of a heading's rendered text.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text: string): string;
/**
 * The text GitHub renders for a heading's inline markdown.
 * @param {string} markdown
 * @returns {string}
 */
export function headingText(markdown: string): string;
export const TOC_START: "<!-- toc -->";
export const TOC_END: "<!-- /toc -->";
/**
 * Options written on a start marker, each `true` or a summary text, and the other attributes for the summary element.
 */
export type TocOptions = {
    collapsible?: true | string;
    collapsed?: true | string;
    levels?: string;
    attributes?: Record<string, string>;
};
/**
 * A heading with its zero based line, level, inline markdown and GitHub slug.
 */
export type Headline = {
    line: number;
    level: number;
    markdown: string;
    slug: string;
};
/**
 * A link to an anchor with its zero based line, text, anchor as written, whether it has a target and, when it
 * has none and one heading clearly matches, a suggestion.
 */
export type Anchor = {
    line: number;
    text: string;
    anchor: string;
    valid: boolean;
    suggestion?: string;
};
/**
 * A marker pair as zero based lines, -1 for a missing side, with its options, a problem when they cannot be used and a warning when one is ignored.
 */
export type Marker = {
    start: number;
    end: number;
    options: TocOptions;
    problem?: string;
    warning?: string;
};
//# sourceMappingURL=index.d.ts.map