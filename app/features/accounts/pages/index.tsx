import type { LoaderFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function loader(loaderArgs: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(loaderArgs.request);
	const { data: accounts } = await supabase.from("accounts").select("*");
	return { accounts };
}

export default function Accounts() {
	// const data = useLoaderData<typeof loader>()
	return <div>Accounts Home</div>;
}
