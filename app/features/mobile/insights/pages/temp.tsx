export const meta: MetaFunction = () => {
	return [{ title: "Mobile Insights | Insights" }, { name: "description", content: "Mobile insights interface" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data: insights, error } = await getInsights({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Insights query error:", error)
		throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
	}

	consola.log(`Found ${insights?.length || 0} insights`)

	return {
		insights: insights || [],
	}
}
