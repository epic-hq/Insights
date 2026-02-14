import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData } from "react-router-dom";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { createOrganization } from "~/features/organizations/db";
import { userContext } from "~/server/user-context";
import { createProjectRoutes } from "~/utils/routes.server";

export const meta: MetaFunction = () => {
	return [{ title: "New Organization | Insights" }, { name: "description", content: "Create a new organization" }];
};

export async function loader({ params }: LoaderFunctionArgs) {
	const accountId = params.accountId;
	const projectId = params.projectId;

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 });
	}

	return { accountId, projectId };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;
	const accountId = params.accountId;
	const projectId = params.projectId;

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 });
	}

	const routes = createProjectRoutes(accountId, projectId);
	const formData = await request.formData();

	const name = (formData.get("name") as string | null)?.trim();
	if (!name) {
		return { error: "Name is required" };
	}

	const legal_name = (formData.get("legal_name") as string | null)?.trim() || null;
	const website_url = (formData.get("website_url") as string | null)?.trim() || null;
	const domain = (formData.get("domain") as string | null)?.trim() || null;
	const industry = (formData.get("industry") as string | null)?.trim() || null;
	const sub_industry = (formData.get("sub_industry") as string | null)?.trim() || null;
	const company_type = (formData.get("company_type") as string | null)?.trim() || null;
	const size_range = (formData.get("size_range") as string | null)?.trim() || null;
	const headquarters_location = (formData.get("headquarters_location") as string | null)?.trim() || null;
	const linkedin_url = (formData.get("linkedin_url") as string | null)?.trim() || null;
	const phone = (formData.get("phone") as string | null)?.trim() || null;
	const email = (formData.get("email") as string | null)?.trim() || null;
	const notes = (formData.get("notes") as string | null)?.trim() || null;
	const description = (formData.get("description") as string | null)?.trim() || null;

	const employeeCountRaw = (formData.get("employee_count") as string | null)?.trim();
	const annualRevenueRaw = (formData.get("annual_revenue") as string | null)?.trim();

	const employee_count = employeeCountRaw ? Number.parseInt(employeeCountRaw, 10) : null;
	const annual_revenue = annualRevenueRaw ? Number.parseFloat(annualRevenueRaw) : null;

	if (employeeCountRaw && Number.isNaN(employee_count)) {
		return { error: "Employee count must be a number" };
	}

	if (annualRevenueRaw && Number.isNaN(annual_revenue)) {
		return { error: "Annual revenue must be a number" };
	}

	try {
		const { data, error } = await createOrganization({
			supabase,
			data: {
				account_id: accountId,
				project_id: projectId,
				name,
				legal_name,
				website_url,
				domain,
				industry,
				sub_industry,
				company_type,
				size_range,
				headquarters_location,
				linkedin_url,
				phone,
				email,
				notes,
				description,
				employee_count,
				annual_revenue,
			},
		});

		if (error || !data) {
			return { error: `Failed to create organization: ${JSON.stringify(error)}` };
		}

		return redirect(routes.organizations.detail(data.id));
	} catch (error) {
		console.error("createOrganization error", error);
		return { error: `Failed to create organization: ${JSON.stringify(error)}` };
	}
}

export default function NewOrganizationPage() {
	const actionData = useActionData<typeof action>();

	return (
		<div className="mx-auto max-w-3xl px-4 py-10">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900 dark:text-white">New Organization</h1>
				<p className="mt-2 text-gray-600 dark:text-gray-400">
					Capture company details to link people and keep account context organized.
				</p>
			</div>

			<Form method="post" className="space-y-6">
				<div className="grid gap-6 md:grid-cols-2">
					<div className="md:col-span-2">
						<Label htmlFor="name">Organization Name *</Label>
						<Input id="name" name="name" required placeholder="Acme Corporation" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="legal_name">Legal Name</Label>
						<Input id="legal_name" name="legal_name" placeholder="Acme Corporation LLC" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="industry">Industry</Label>
						<Input id="industry" name="industry" placeholder="e.g., Software" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="sub_industry">Sub-industry</Label>
						<Input id="sub_industry" name="sub_industry" placeholder="e.g., Analytics" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="company_type">Company Type</Label>
						<Input id="company_type" name="company_type" placeholder="e.g., B2B SaaS" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="size_range">Size Range</Label>
						<Input id="size_range" name="size_range" placeholder="e.g., 51-200" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="employee_count">Employee Count</Label>
						<Input id="employee_count" name="employee_count" type="number" min={0} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="annual_revenue">Annual Revenue (USD)</Label>
						<Input id="annual_revenue" name="annual_revenue" type="number" min={0} step="0.01" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="website_url">Website</Label>
						<Input id="website_url" name="website_url" placeholder="https://example.com" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="domain">Domain</Label>
						<Input id="domain" name="domain" placeholder="example.com" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="linkedin_url">LinkedIn</Label>
						<Input
							id="linkedin_url"
							name="linkedin_url"
							placeholder="https://linkedin.com/company/example"
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="headquarters_location">Headquarters</Label>
						<Input
							id="headquarters_location"
							name="headquarters_location"
							placeholder="City, Country"
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="phone">Phone</Label>
						<Input id="phone" name="phone" placeholder="+1 (555) 123-4567" className="mt-1" />
					</div>
					<div>
						<Label htmlFor="email">Email</Label>
						<Input id="email" name="email" type="email" placeholder="contact@example.com" className="mt-1" />
					</div>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						rows={4}
						placeholder="What does this organization do?"
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						rows={4}
						placeholder="Key context, buying signals, account notes"
						className="mt-1"
					/>
				</div>

				{actionData?.error && (
					<div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
						{actionData.error}
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Create organization</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	);
}
