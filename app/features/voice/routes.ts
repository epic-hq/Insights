import { type RouteConfig, route } from "@react-router/dev/routes"

export default [route("/api/transcribe", "./features/voice/api/transcribe.ts")] satisfies RouteConfig
