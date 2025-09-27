import { LoaderFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/server";
import { getAccounts } from "../db";
import { getAuthenticatedUser } from "~/lib/supabase/server";

export async function loader({ request }: LoaderFunctionArgs) {
	const { client, headers } = getServerClient(request)
	const user = await getAuthenticatedUser(request)

	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data, error } = await getAccounts({ supabase: client })
	if (error) {
		throw error
	}
	return {
		data,
	}
}

export default function TeamsList() {
	return (
		<div>
			<h1>Teams</h1>
		</div>
	)
}
