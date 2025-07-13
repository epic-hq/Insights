import { type MetaFunction, useLoaderData } from "react-router"
import Dashboard from "~/components/dashboard/Dashboard"
import { sampleData } from "~/data/sampleData"

export const meta: MetaFunction = () => {
	return [{ title: "Insights Dashboard" }, { name: "description", content: "Insights for conversations" }]
}

// Mock data for demonstration purposes
export function loader() {
	return sampleData
}

export default function Index() {
	const data = useLoaderData<typeof loader>()

	return <Dashboard {...data} />
}
