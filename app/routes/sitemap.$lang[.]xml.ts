import { generateRemixSitemap } from "@forge42/seo-tools/remix/sitemap";
import { createDomain } from "~/utils/http";

type LoaderArgs = {
	request: Request;
	params: {
		lang?: string;
	};
};

export const loader = async ({ request, params }: LoaderArgs) => {
	const domain = createDomain(request);

	const { routes } = await import("virtual:react-router/server-build");

	const sitemap = await generateRemixSitemap({
		domain,
		routes,
		ignore: ["/resource/*"],
		// Transforms the url before adding it to the sitemap
		urlTransformer: (url) => `${url}?lng=${params.lang}`,
		sitemapData: {
			lang: params.lang,
		},
	});

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
};
