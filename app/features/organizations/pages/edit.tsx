import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { getOrganizationById, updateOrganization } from "~/features/organizations/db"
import { userContext } from "~/server/user-context"
import type { Organization } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const title = data?.organization?.name ? `Edit ${data.organization.name}` : "Edit Organization"
	return [{ title }, { name: "description", content: "Edit organization details" }]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	const organizationId = params.organizationId

	if (!accountId || !projectId || !organizationId) {
		throw new Response("Account ID, Project ID, and Organization ID are required", { status: 400 })
	}

	const { data, error } = await getOrganizationById({ supabase, accountId, projectId, id: organizationId })
	if (error || !data) {
		throw new Response("Failed to load organization", { status: 500 })
	}

	return { organization: data as Organization }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	const organizationId = params.organizationId

	if (!accountId || !projectId || !organizationId) {
		throw new Response("Account ID, Project ID, and Organization ID are required", { status: 400 })
	}

	const routes = createProjectRoutes(accountId, projectId)
	const formData = await request.formData()

	const name = (formData.get("name") as string | null)?.trim()
	if (!name) {
		return { error: "Name is required" }
	}

	const legal_name = (formData.get("legal_name") as string | null)?.trim() || null
	const website_url = (formData.get("website_url") as string | null)?.trim() || null
	const domain = (formData.get("domain") as string | null)?.trim() || null
	const industry = (formData.get("industry") as string | null)?.trim() || null
	const sub_industry = (formData.get("sub_industry") as string | null)?.trim() || null
	const company_type = (formData.get("company_type") as string | null)?.trim() || null
	const size_range = (formData.get("size_range") as string | null)?.trim() || null
	const headquarters_location = (formData.get("headquarters_location") as string | null)?.trim() || null
	const linkedin_url = (formData.get("linkedin_url") as string | null)?.trim() || null
	const phone = (formData.get("phone") as string | null)?.trim() || null
	const email = (formData.get("email") as string | null)?.trim() || null
	const notes = (formData.get("notes") as string | null)?.trim() || null
	const description = (formData.get("description") as string | null)?.trim() || null

	const employeeCountRaw = (formData.get("employee_count") as string | null)?.trim()
	const annualRevenueRaw = (formData.get("annual_revenue") as string | null)?.trim()

	const employee_count = employeeCountRaw ? Number.parseInt(employeeCountRaw, 10) : null
	const annual_revenue = annualRevenueRaw ? Number.parseFloat(annualRevenueRaw) : null

	if (employeeCountRaw && Number.isNaN(employee_count)) {
		return { error: "Employee count must be a number" }
	}

	if (annualRevenueRaw && Number.isNaN(annual_revenue)) {
		return { error: "Annual revenue must be a number" }
	}

	const { error } = await updateOrganization({
		supabase,
		accountId,
		projectId,
		id: organizationId,
		data: {
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
	})

	if (error) {
		return { error: "Failed to update organization" }
	}

	return redirect(routes.organizations.detail(organizationId))
}

export default function EditOrganizationPage() {
	const { organization } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	return (
		<div className="mx-auto max-w-3xl px-4 py-10">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900 dark:text-white">Edit Organization</h1>
				<p className="mt-2 text-gray-600 dark:text-gray-400">
					Update company information to keep your CRM data accurate.
				</p>
			</div>

			<Form method="post" className="space-y-6">
				<div className="grid gap-6 md:grid-cols-2">
					<div className="md:col-span-2">
						<Label htmlFor="name">Organization Name *</Label>
						<Input id="name" name="name" required defaultValue={organization.name || ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="legal_name">Legal Name</Label>
						<Input id="legal_name" name="legal_name" defaultValue={organization.legal_name ?? ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="industry">Industry</Label>
						<Input id="industry" name="industry" defaultValue={organization.industry ?? ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="sub_industry">Sub-industry</Label>
						<Input
							id="sub_industry"
							name="sub_industry"
							defaultValue={organization.sub_industry ?? ""}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="company_type">Company Type</Label>
						<Input
							id="company_type"
							name="company_type"
							defaultValue={organization.company_type ?? ""}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="size_range">Size Range</Label>
						<Input id="size_range" name="size_range" defaultValue={organization.size_range ?? ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="employee_count">Employee Count</Label>
						<Input
							id="employee_count"
							name="employee_count"
							type="number"
							min={0}
							defaultValue={organization.employee_count ?? undefined}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="annual_revenue">Annual Revenue (USD)</Label>
						<Input
							id="annual_revenue"
							name="annual_revenue"
							type="number"
							min={0}
							step="0.01"
							defaultValue={organization.annual_revenue ?? undefined}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="website_url">Website</Label>
						<Input id="website_url" name="website_url" defaultValue={organization.website_url ?? ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="domain">Domain</Label>
						<Input id="domain" name="domain" defaultValue={organization.domain ?? ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="linkedin_url">LinkedIn</Label>
						<Input
							id="linkedin_url"
							name="linkedin_url"
							defaultValue={organization.linkedin_url ?? ""}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="headquarters_location">Headquarters</Label>
						<Input
							id="headquarters_location"
							name="headquarters_location"
							defaultValue={organization.headquarters_location ?? ""}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="phone">Phone</Label>
						<Input id="phone" name="phone" defaultValue={organization.phone ?? ""} className="mt-1" />
					</div>
					<div>
						<Label htmlFor="email">Email</Label>
						<Input id="email" name="email" type="email" defaultValue={organization.email ?? ""} className="mt-1" />
					</div>
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						rows={4}
						defaultValue={organization.description ?? ""}
						className="mt-1"
					/>
				</div>

				<div>
					<Label htmlFor="notes">Notes</Label>
					<Textarea id="notes" name="notes" rows={4} defaultValue={organization.notes ?? ""} className="mt-1" />
				</div>

				{actionData?.error && (
					<div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
						{actionData.error}
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit">Save changes</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
