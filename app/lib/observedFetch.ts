import { getLangfuseClient } from "~/lib/langfuse"

type Input = Parameters<typeof fetch>[0]
type Init = Parameters<typeof fetch>[1]

export async function observedFetch(input: Input, init?: Init) {
  const langfuse = getLangfuseClient()
  const trace = (langfuse as any).trace?.({ name: "fetch" })
  const gen = trace?.generation?.({ name: "fetch" })
  const url = typeof input === "string" ? input : (input as Request).url
  const method = (init as RequestInit)?.method || (typeof input !== "string" ? (input as Request).method : "GET")
  const started = Date.now()
  try {
    const res = await fetch(input as any, init as any)
    const durationMs = Date.now() - started
    gen?.update?.({ input: { url, method }, output: { status: res.status, ok: res.ok, durationMs } })
    return res
  } catch (e) {
    gen?.end?.({ level: "ERROR", statusMessage: (e as Error)?.message })
    throw e
  } finally {
    gen?.end?.()
    ;(trace as any).end?.()
  }
}
