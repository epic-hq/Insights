
import { flatRoutes } from "@react-router/fs-routes"

// export default flatRoutes({
// 	ignoredRouteFiles: ["**/*.test.{ts,tsx}"],
// })

const routes = flatRoutes({
	ignoredRouteFiles: ["**/*.test.{ts,tsx}"],
	rootDirectory: "./routes",
	// ".well-known/appspecific/com.chrome.devtools.json": "./routes/.well-known/appspecific/com.chrome.devtools.json",
	// "/": "./routes/index.tsx",
	// "/about": "./routes/about.tsx",
	// "/login": "./routes/login.tsx",
	// "/register": "./routes/register.tsx",
	// "/dashboard": "./routes/dashboard.tsx",
	// "/interviews": "./routes/interviews.tsx",
	// "/insights": "./routes/insights.tsx",
	// "/personas": "./routes/personas.tsx",
	// "/projects": "./routes/projects.tsx",
})
// const routes: RouteConfig = [route("/hello", "./routes/about.tsx"), ...(await flatRoutes({
// 	rootDirectory: "fs-routes",
// }))]
export default routes