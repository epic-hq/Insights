import type { LoaderFunctionArgs } from "react-router";

import { buildLlmsTxt } from "~/lib/llms.server";
import { createDomain } from "~/utils/http";

export async function loader({ request }: LoaderFunctionArgs) {
	const domain = createDomain(request);
	const content = await buildLlmsTxt(domain);

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=900, stale-while-revalidate=86400",
		},
	});
}
