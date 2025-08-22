import type { ActionFunctionArgs } from "react-router"
import { testAssemblyAIConnection } from "~/utils/assemblyai-test.server"
import consola from "consola"

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 })
  }

  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "ASSEMBLYAI_API_KEY not found in environment" }, { status: 500 })
    }

    consola.log("Running AssemblyAI connection test...")
    const result = await testAssemblyAIConnection(apiKey)
    
    if (result.success) {
      consola.log("✅ AssemblyAI test successful")
      return Response.json({ success: true, message: result.message })
    } else {
      consola.error("❌ AssemblyAI test failed:", result.error)
      return Response.json({ success: false, error: result.error }, { status: 500 })
    }
    
  } catch (error) {
    consola.error("Test endpoint error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    )
  }
}