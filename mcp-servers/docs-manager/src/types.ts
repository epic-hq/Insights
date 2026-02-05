export interface DocFile {
	path: string;
	relativePath: string;
	content: string;
	frontmatter?: Record<string, any>;
	headings: string[];
	links: string[];
}

export interface LinkValidationResult {
	file: string;
	brokenLinks: Array<{
		link: string;
		line: number;
		reason: string;
	}>;
}

export interface SearchResult {
	path: string;
	relativePath: string;
	score: number;
	matches: Array<{
		line: number;
		content: string;
		context: string;
	}>;
	headings: string[];
}
