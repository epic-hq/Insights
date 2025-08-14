import consola from "consola"
import { type LoaderFunctionArgs, useLoaderData } from "react-router-dom"
import UserSettings from "~/features/users/components/UserSettings"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const { user_settings } = ctx
	return { user_settings }
}

export default function Profile() {
	const { user_settings } = useLoaderData<typeof loader>()
	consola.log("user_settings", user_settings)
	return (
		<div className="mx-auto max-w-3xl p-6">
			<UserSettings settings={user_settings || {}} />
		</div>
	)
}
