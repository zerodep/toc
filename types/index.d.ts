declare module '@0dep/toc' {
	/**
	 * Return the markdown with the toc between every `<!-- toc -->` and `<!-- /toc -->` pair regenerated. Each
	 * pair lists every heading below its own start marker. A pair is left alone when it is unbalanced, has a
	 * problem on its start marker, or has no headings below it, and nothing outside the pairs is ever touched.
	 * The start marker line is kept as written, options included.
	 * */
	export function buildToc(source: string): string;
	/**
	 * Return the toc block, markers included, for the headings below `fromLine`, by default every heading so the
	 * block can be pasted into a document without markers. Returns an empty string when there is nothing to list.
	 * @param fromLine zero based line number, typically the start marker's
	 * @param options rendered into the start marker, e.g. `{ collapsed: 'Contents' }`
	 * */
	export function renderToc(source: string, fromLine?: number, options?: TocOptions): string;
	/**
	 * Every marker pair in document order as zero based line numbers, outside fenced code blocks. A start marker
	 * pairs with the first end marker after it. A missing side is -1: a start marker without an end marker, or an
	 * end marker with no open start marker before it. `options` holds the recognised options written on the start
	 * marker and `problem`, only present when there is one, says why the marker cannot be used.
	 * */
	export function findMarkers(source: string): Marker[];
	/**
	 * Slug a heading's rendered text the way github-slugger does: lowercase, drop everything that is not a
	 * letter, number, mark, space, hyphen or underscore, then turn each space into a hyphen. Nothing is trimmed
	 * or collapsed.
	 * */
	export function slugify(text: string): string;
	/**
	 * Reduce a heading's inline markdown to the text GitHub renders and slugs.
	 * */
	export function headingText(markdown: string): string;
	export const TOC_START: "<!-- toc -->";
	export const TOC_END: "<!-- /toc -->";
	/**
	 * Options written on a start marker. `collapsible` wraps the list in a details element that starts open,
	 * `collapsed` in one that starts closed. Each is `true` for the default summary "Table of contents" or a
	 * string for a custom one. `attributes` are the other `name="value"` pairs on the marker, rendered on the
	 * summary element in the order written, only present when there are any.
	 */
	export type TocOptions = {
		collapsible?: true | string;
		collapsed?: true | string;
		attributes?: Record<string, string>;
	};
	/**
	 * A marker pair. `start` and `end` are zero based line numbers, -1 when that side is missing. `problem` is
	 * only present when the start marker cannot be used: an unknown option or an impossible combination.
	 */
	export type Marker = {
		start: number;
		end: number;
		options: TocOptions;
		problem?: string;
	};

	export {};
}

//# sourceMappingURL=index.d.ts.map