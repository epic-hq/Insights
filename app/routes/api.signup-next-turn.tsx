import { RequestContext } from "@mastra/core/di"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"
import { mastra } from "~/mastra"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return { error: "Method Not Allowed" }

	const { user } = await getAuthenticatedUser(request)
	if (!user) return { error: "Unauthorized" }

	const { client: supabase } = getServerClient(request)

	try {
		const body = await request.json()
		const { message, state } = body ?? {}

		const run = await mastra.getWorkflow("signupOnboardingWorkflow")?.createRunAsync()
		const requestContext = new RequestContext()
		requestContext.set("supabase", supabase)

		consola.log("➡️ api.signup-next-turn: running workflow", {
			hasMessage: !!message,
			hasState: !!state,
		})

		const result = await run?.start({
			inputData: {
				message: typeof message === "string" ? message : "",
				user_id: user.sub,
				state: state ?? {},
			},
			requestContext,
		})

		if (result?.status === "success") {
			const out = result.result as any
			consola.log("✅ api.signup-next-turn: success", out)
			return {
				reply: out.reply,
				state: out.state,
				completed: out.completed,
			}
		}

		return {
			reply: "Let's continue — what business objective are you trying to achieve?",
			state: state ?? {},
			completed: false,
		}
	} catch (error) {
		consola.error("💥 api.signup-next-turn error", error)
		return {
			error: "Failed to run signup workflow",
			reply: "Sorry — hit a hiccup. What business objective are you trying to achieve?",
			state: {},
			completed: false,
		}
	}
}

export const loader = () => ({ error: "Method Not Allowed" })
