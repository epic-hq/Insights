import { prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("onboarding", [

		route("mock", "./features/onboarding/pages/mock.tsx")
	])
] satisfies RouteConfig