import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Resource } from "~/localization/resource";
import { convertDateToUserTz } from "~/utils/dates";
import type { Route } from "../+types/root";
import "@dotenvx/dotenvx/config";

export const meta: MetaFunction = () => {
	return [{ title: "New Remix App" }, { name: "description", content: "Welcome to Remix!" }];
};

export async function loader(args: Route.LoaderArgs) {
	const now = new Date();
	const userDate = convertDateToUserTz(now, args.request);
	// Get environment variables from context
	const { clientEnv } = args.context;
	// console.log("clientEnv", clientEnv)
	// console.debug(`process.env.SUPABASE_URL: ${process.env.SUPABASE_URL}`)
	return {
		myurl: args.request.url,
		currentDate: userDate,
		// Access environment variables from server context instead of process.env
		helloValue: clientEnv ? (clientEnv as Record<string, string>).HELLO || "Not set" : "Not available",
	};
}

export default function Index() {
	const { myurl, currentDate, helloValue } = useLoaderData();

	// Using Resource type for type checking
	const resourceExample: Resource = {
		common: {
			hi: "Hello World",
			navigation: {
				back: "Go back",
				home: "Back to home",
			},
			error: {
				"500": {
					title: "Something went wrong!",
					description: "Looks like something unexpected happened on the server.",
				},
				"404": {
					title: "Page Not found!",
					description: "Oops!",
				},
				"403": {
					title: "Unauthorized!",
					description: "Looks like you can't access this page.",
				},
				"200": {
					title: "Something went wrong!",
					description: "Looks like something unexpected happened on the server.",
				},
			},
		},
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4 dark:from-blue-950 dark:to-blue-900 dark:text-white">
			<Card>
				<CardHeader>
					<CardTitle>This is the new Starter Kit</CardTitle>
				</CardHeader>
				<CardContent>
					<p>URL: {myurl}</p>
					<p>Current Date: {currentDate.toString()}</p>
					<p>Resource example: {resourceExample.common.hi}</p>
					<p>Environment variable HELLO: {helloValue}</p>
				</CardContent>
			</Card>
		</div>
	);
}
