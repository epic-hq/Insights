import { generateRobotsTxt } from "@forge42/seo-tools/robots";

import { createDomain } from "~/utils/http";

type LoaderArgs = { request: Request };

export async function loader({ request }: LoaderArgs) {
	const isProductionDeployment = process.env.NODE_ENV === "production";
	const domain = createDomain(request);
	const robotsTxt = generateRobotsTxt([
		{
			userAgent: "*",
			...(isProductionDeployment
				? {
						allow: ["/"],
						disallow: ["/a/", "/api/", "/auth/"],
					}
				: {
						disallow: ["/"],
					}),
			sitemap: [`${domain}/sitemap.xml`],
		},
	]);
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
