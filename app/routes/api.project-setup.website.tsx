/**
 * API endpoint for researching a company website during project setup
 * Uses the shared researchCompanyWebsite function
 */
import type { ActionFunctionArgs } from "react-router";
import { researchCompanyWebsite } from "~/mastra/tools/research-company-website";

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const websiteUrl = formData.get("website_url") as string | null;

	return researchCompanyWebsite(websiteUrl || "");
}
