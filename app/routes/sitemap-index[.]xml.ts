import { generateSitemapIndex } from "@forge42/seo-tools/sitemap";
import { createDomain } from "~/utils/http";

type LoaderArgs = {
	request: Request;
};

export const loader = async ({ request }: LoaderArgs) => {
	const domain = createDomain(request);
	const sitemaps = generateSitemapIndex([
		{
			url: `${domain}/sitemap/en.xml`,
			lastmod: "2024-07-17",
		},
		{
			url: `${domain}/sitemap/bs.xml`,
			lastmod: "2024-07-17",
		},
	]);

	return new Response(sitemaps, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
};
