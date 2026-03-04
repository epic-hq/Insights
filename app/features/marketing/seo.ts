const SITE_ORIGIN = "https://getupsight.com";
export const INTENTIONAL_NOINDEX_PATHS = ["/index2"] as const;

type MetaEntry = {
	name?: string;
	content?: string;
	tagName?: "link";
	rel?: string;
	href?: string;
};

export function canonicalUrl(path: string): string {
	if (!path || path === "/") return SITE_ORIGIN;
	return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function canonicalLink(path: string): { rel: "canonical"; href: string } {
	return {
		rel: "canonical",
		href: canonicalUrl(path),
	};
}

export function indexRobotsMeta(): MetaEntry {
	return { name: "robots", content: "index,follow" };
}

export function noindexRobotsMeta(): MetaEntry {
	return { name: "robots", content: "noindex,nofollow" };
}

export function isIntentionalNoindexPath(path: string): boolean {
	return (INTENTIONAL_NOINDEX_PATHS as readonly string[]).includes(path);
}

export function canonicalMetaTag(path: string): MetaEntry {
	return {
		tagName: "link",
		rel: "canonical",
		href: canonicalUrl(path),
	};
}
