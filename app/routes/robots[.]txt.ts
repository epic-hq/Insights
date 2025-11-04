import { generateRobotsTxt } from "@forge42/seo-tools/robots"

import { createDomain } from "~/utils/http"

type LoaderArgs = {
	request: Request
	context: {
		isProductionDeployment: boolean
	}
}

export async function loader({ request, context }: LoaderArgs) {
	const { isProductionDeployment } = context
	const domain = createDomain(request)
	const robotsTxt = generateRobotsTxt([
		{
			userAgent: "*",
			[isProductionDeployment ? "allow" : "disallow"]: ["/"],
			sitemap: [`${domain}/sitemap-index.xml`],
		},
	])
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain",
		},
	})
}
