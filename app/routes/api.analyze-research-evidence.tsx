import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { runEvidenceAnalysis } from "~/features/research/analysis/runEvidenceAnalysis.server"
import { getServerClient } from "~/lib/supabase/client.server"

const DEFAULT_MIN_CONFIDENCE = 0.6

function parseOptionalNumber(value: FormDataEntryValue | null, fallback: number): number {
	if (!value) return fallback
	const parsed = Number(value)
	if (Number.isNaN(parsed)) return fallback
	return Math.min(1, Math.max(0, parsed))
}

export async function action({ request }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)

	try {
		const formData = await request.formData()
		const projectId = formData.get("projectId")?.toString()
		const interviewId = formData.get("interviewId")?.toString() || null
		const customInstructions = formData.get("customInstructions")?.toString() ?? ""
		const minConfidence = parseOptionalNumber(formData.get("minConfidence"), DEFAULT_MIN_CONFIDENCE)

		if (!projectId) {
			return { error: "Project ID is required", status: 400 }
		}

		consola.info(`[research-analysis] Starting evidence analysis for project ${projectId}`)

		const result = await runEvidenceAnalysis({
			supabase,
			projectId,
			interviewId,
			customInstructions,
			minConfidence,
		})

		return {
			...result,
		}
	} catch (error) {
		consola.error("[research-analysis] Analysis failed", error)
		return {
			error: "Research analysis failed",
			details: error instanceof Error ? error.message : "Unknown error",
			status: 500,
		}
	}
}
