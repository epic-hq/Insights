import { type LoaderFunctionArgs, type MetaFunction, redirect } from "react-router"

export const meta: MetaFunction = () => {
	return [{ title: "Insights Dashboard" }, { name: "description", content: "Insights for conversations" }]
}

export async function loader({ params }: LoaderFunctionArgs) {
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	return redirect(`/a/${accountId}/${projectId}`)
}

export default function DashboardPage() {
	return null
}
