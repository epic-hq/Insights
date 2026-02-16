import { stringify } from "qs-esm";

import { getServerEnv } from "~/env.server";
import { getPosts, type PayloadPost } from "~/lib/cms/payload.server";

interface CmsCollectionResponse<T> {
	docs: T[];
}

interface PayloadCaseStudy {
	title?: string;
	slug: string;
	excerpt?: string;
	meta?: {
		description?: string;
	};
	updatedAt?: string;
}

interface LlmDoc {
	title: string;
	url: string;
	description?: string;
	updatedAt?: string;
}

interface LlmsContent {
	basePages: LlmDoc[];
	blogPosts: LlmDoc[];
	caseStudies: LlmDoc[];
}

const BASE_PAGES: Array<{ path: string; title: string; description?: string }> = [
	{
		path: "/",
		title: "Homepage",
		description: "UpSight marketing homepage.",
	},
	{
		path: "/blog",
		title: "Blog",
		description: "Articles about customer discovery and product research.",
	},
	{
		path: "/case-studies",
		title: "Case Studies",
		description: "Customer outcomes and implementation stories.",
	},
	{
		path: "/pricing",
		title: "Pricing",
		description: "Plan and pricing details.",
	},
	{
		path: "/customer-discovery",
		title: "Customer Discovery",
		description: "Customer discovery overview and workflows.",
	},
	{
		path: "/customer-discovery-for-consultants",
		title: "Customer Discovery for Consultants",
		description: "Consultant-focused customer discovery guide.",
	},
	{
		path: "/about",
		title: "About",
		description: "Company overview.",
	},
	{
		path: "/privacy",
		title: "Privacy Policy",
	},
	{
		path: "/terms",
		title: "Terms",
	},
];

function asAbsoluteUrl(domain: string, path: string) {
	return `${domain}${path.startsWith("/") ? path : `/${path}`}`;
}

function compactText(text: string | undefined) {
	if (!text) return undefined;
	return text.replace(/\s+/g, " ").trim();
}

function toBlogDoc(domain: string, post: PayloadPost): LlmDoc {
	return {
		title: post.title,
		url: asAbsoluteUrl(domain, `/blog/${post.slug}`),
		description: compactText(post.meta?.description || post.excerpt),
		updatedAt: post.updatedAt,
	};
}

function toCaseStudyDoc(domain: string, study: PayloadCaseStudy): LlmDoc {
	return {
		title: study.title || study.slug,
		url: asAbsoluteUrl(domain, `/case-studies/${study.slug}`),
		description: compactText(study.meta?.description || study.excerpt),
		updatedAt: study.updatedAt,
	};
}

async function getCaseStudies(limit = 100): Promise<PayloadCaseStudy[]> {
	const env = getServerEnv();
	const query = stringify(
		{
			limit,
			sort: "-publishedAt",
			where: {
				status: {
					equals: "published",
				},
			},
		},
		{ addQueryPrefix: true }
	);

	const response = await fetch(`${env.PAYLOAD_CMS_URL}/api/case-studies${query}`, {
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch case studies (${response.status})`);
	}

	const data = (await response.json()) as CmsCollectionResponse<PayloadCaseStudy>;
	return data.docs || [];
}

export async function buildLlmsContent(domain: string): Promise<LlmsContent> {
	const basePages = BASE_PAGES.map((page) => ({
		title: page.title,
		url: asAbsoluteUrl(domain, page.path),
		description: page.description,
	}));

	const [blogResult, caseStudyResult] = await Promise.allSettled([
		getPosts({ limit: 100, page: 1 }),
		getCaseStudies(100),
	]);

	const blogPosts =
		blogResult.status === "fulfilled" ? blogResult.value.docs.map((post) => toBlogDoc(domain, post)) : [];
	const caseStudies =
		caseStudyResult.status === "fulfilled" ? caseStudyResult.value.map((study) => toCaseStudyDoc(domain, study)) : [];

	return { basePages, blogPosts, caseStudies };
}

function renderDocLine(doc: LlmDoc) {
	const parts = [`- [${doc.title}](${doc.url})`];
	if (doc.description) {
		parts.push(`- ${doc.description}`);
	}
	if (doc.updatedAt) {
		parts.push(`(updated: ${new Date(doc.updatedAt).toISOString().slice(0, 10)})`);
	}
	return parts.join(" ");
}

export async function buildLlmsTxt(domain: string) {
	const content = await buildLlmsContent(domain);
	const lines = [
		"# UpSight",
		"",
		"> UpSight helps teams turn customer conversations into product and growth insights.",
		"",
		`Canonical: ${domain}`,
		`Full index: ${asAbsoluteUrl(domain, "/llms-full.txt")}`,
		"",
		"## Core Pages",
		...content.basePages.map(renderDocLine),
		"",
		"## Machine-readable",
		`- ${asAbsoluteUrl(domain, "/sitemap.xml")}`,
		`- ${asAbsoluteUrl(domain, "/robots.txt")}`,
		"",
		"## Notes",
		"- Most /api routes are authenticated application endpoints and are not public knowledge-base content.",
		`- Generated: ${new Date().toISOString()}`,
		"",
	];

	return lines.join("\n");
}

export async function buildLlmsFullTxt(domain: string) {
	const content = await buildLlmsContent(domain);

	const lines = [
		"# UpSight llms-full",
		"",
		`Canonical: ${domain}`,
		`Index: ${asAbsoluteUrl(domain, "/llms.txt")}`,
		`Generated: ${new Date().toISOString()}`,
		"",
		"## Core Pages",
		...content.basePages.map(renderDocLine),
		"",
		"## Blog Posts",
		...(content.blogPosts.length > 0
			? content.blogPosts.map(renderDocLine)
			: ["- Blog post index unavailable at generation time."]),
		"",
		"## Case Studies",
		...(content.caseStudies.length > 0
			? content.caseStudies.map(renderDocLine)
			: ["- Case study index unavailable at generation time."]),
		"",
	];

	return lines.join("\n");
}
