import { layout, type RouteConfig, route } from "@react-router/dev/routes"
import dashboardRoutes from "./features/dashboard/routes"
import personasRoutes from "./features/personas/routes"

const routes = [
	layout("./routes/_NavLayout.tsx", [
		...dashboardRoutes,
		...personasRoutes]),
	route("/resource/locales", "./routes/resource.locales.ts"),
	// route("/.well-known/appspecific/com.chrome.devtools.json", ".well-known/appspecific/com.chrome.devtools.json.ts"),
	route("login", "./routes/login.tsx"),
	route("register", "./routes/register.tsx"),
	route("signout", "./routes/auth.signout.tsx"),

] satisfies RouteConfig

export default routes
