// CopilotKit runtime removed
import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"

export async function action() {
    return new Response(JSON.stringify({ error: "Copilot runtime removed" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
    })
}
