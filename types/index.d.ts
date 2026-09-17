declare module '@0dep/toc' {
	/**
	 * The markdown with the toc between every `<!-- toc -->` and `<!-- /toc -->` pair regenerated.
	 * */
	export function buildToc(source: string): string;
	/**
	 * The toc block, markers included, for the headings below `fromLine`, empty when there is nothing to list.
	 * @param fromLine zero based
	 * */
	export function renderToc(source: string, fromLine?: number, options?: TocOptions): string;
	/**
	 * Every marker pair in document order, shared with later calls for the same source.
	 * */
	export function findMarkers(source: string): Marker[];
	/**
	 * Every link to an anchor in the document, in order, shared with later calls for the same source.
	 * */
	export function findAnchors(source: string): Anchor[];
	/**
	 * The GitHub anchor slug of a heading's rendered text.
	 * */
	export function slugify(text: string): string;
	/**
	 * The text GitHub renders for a heading's inline markdown.
	 * */
	export function headingText(markdown: string): string;
	export const TOC_START: "<!-- toc -->";
	export const TOC_END: "<!-- /toc -->";
	/**
	 * Options written on a start marker, each `true` or a summary text, and the other attributes for the summary element.
	 */
	export type TocOptions = {
		collapsible?: true | string;
		collapsed?: true | string;
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
	 * A marker pair as zero based lines, -1 for a missing side, with its options and a problem when they cannot be used.
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