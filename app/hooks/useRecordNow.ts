import consola from "consola"
import { useCallback, useState } from "react"
import { useNavigate, useRouteLoaderData } from "react-router"

interface RecordNowOptions {
	projectId?: string
	redirect?: boolean
}

interface RecordNowResult {
	projectId: string
	interviewId: string
	path: string
}

interface ProtectedRouteData {
	auth?: { accountId: string }
}

export function useRecordNow() {
	const navigate = useNavigate()
	const routeData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedRouteData | null
	const accountId = routeData?.auth?.accountId
	const accountBase = accountId ? `/a/${accountId}` : null
	const [isRecording, setIsRecording] = useState(false)

	const recordNow = useCallback(
		async ({ projectId, redirect = true }: RecordNowOptions = {}): Promise<RecordNowResult | null> => {
			if (!accountId || !accountBase) {
				consola.error("Record Now error: missing account context")
				return null
			}

			setIsRecording(true)

			try {
				if (projectId) {
					const res = await fetch(`${accountBase}/${projectId}/api/interviews/realtime-start`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({}),
					})
					const data = await res.json()
					if (!res.ok) throw new Error(data?.error || "Failed to start interview")

					const path = `${accountBase}/${projectId}/interviews/${data.interviewId}/realtime`
					if (redirect) navigate(path)
					return { projectId, interviewId: data.interviewId, path }
				}

				const res = await fetch(`${accountBase}/api/interviews/record-now`, { method: "POST" })
				const data = await res.json()
				if (!res.ok) throw new Error(data?.error || "Failed to start quick recording")

				const { projectId: newProjectId, interviewId } = data || {}
				if (newProjectId && interviewId) {
					const path = `${accountBase}/${newProjectId}/interviews/${interviewId}/realtime`
					if (redirect) navigate(path)
					return { projectId: newProjectId, interviewId, path }
				}

				throw new Error("Invalid response from Record Now API")
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				consola.error("Record Now error:", message)
				const fallback = `${accountBase}/projects/new?from=record`
				if (redirect) navigate(fallback)
				return null
			} finally {
				setIsRecording(false)
			}
		},
		[accountBase, accountId, navigate],
	)

	return {
		recordNow,
		isRecording,
		accountId,
	}
}

export type UseRecordNow = typeof useRecordNow
