import { createBrowserClient } from "@supabase/ssr"
import { useState } from "react"
import { Form, Link, type MetaFunction, redirect, useNavigate } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getServerClient } from "~/lib/supabase/server"
import type { Route } from "./+types/login"

export const meta: MetaFunction = () => {
	return [
		{ title: "Login - New React Router Supabase App" },
		{
			name: "description",
			content: "Login to your account in React Router with Supabase!",
		},
	]
}

export async function loader({ request }: Route.LoaderArgs) {
	const sbServerClient = getServerClient(request)
	const userResponse = await sbServerClient.client.auth.getUser()

	if (userResponse?.data?.user) {
		throw redirect("/home", { headers: sbServerClient.headers })
	}

	return {
		env: {
			SUPABASE_URL: process.env.SUPABASE_URL!,
			SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
		},
		headers: sbServerClient.headers,
	}
}

export default function Login({ loaderData }: Route.ComponentProps) {
	const [error, setError] = useState<string | null>(null)
	const { env } = loaderData
	const navigate = useNavigate()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const doLogin = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		const dataFields = Object.fromEntries(formData.entries())

		const supabase = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
		const { data, error } = await supabase.auth.signInWithPassword({
			email: dataFields.email as string,
			password: dataFields.password as string,
		})

		if (error) {
			setError(error.message)
			return
		}

		if (data.session) {
			// Redirect to home page on successful login
			navigate(routes.dashboard())
		}
	}

	return (
		<div className="mx-auto w-[500px] min-w-3/4 p-8">
			<h1 className="text-2xl">React Router v7 Supabase Auth: Login</h1>
			<Form method="post" className="mt-6 " onSubmit={doLogin}>
				<div className="flex flex-col gap-2">
					<div className="flex flex-row">
						<label htmlFor="email" className="min-w-24 ">
							Email:
						</label>
						<input id="email" className="flex-1" type="email" name="email" placeholder="Enter your email" />
					</div>
					<div className="flex flex-row">
						<label htmlFor="password" className="min-w-24 ">
							Password:
						</label>
						<input id="password" className="flex-1" type="password" name="password" placeholder="Enter your password" />
					</div>
					<div className="mt-4 flex flex-row-reverse gap-4">
						<button type="submit" className="w-32 rounded border bg-blue-500 px-2.5 py-1 text-white">
							Login
						</button>
						<Link to="/register">
							<button type="button" className="w-32 rounded border border-blue-500 px-2.5 py-1 text-blue-500">
								Register
							</button>
						</Link>
					</div>
					{error ? (
						<div className="flex flex-row">
							<p className="mt-4 text-red-600 ">{error}</p>
						</div>
					) : null}
				</div>
			</Form>
		</div>
	)
}
