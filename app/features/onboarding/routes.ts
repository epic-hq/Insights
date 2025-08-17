import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("onboarding", [
		index("./features/onboarding/pages/index.tsx"),
		route("mock", "./features/onboarding/pages/mock.tsx")
	])
] satisfies RouteConfig