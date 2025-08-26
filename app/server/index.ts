import { createHonoServer } from "react-router-hono-server/node"
import { i18next } from "remix-hono/i18next"
import i18nextOpts from "../localization/i18n.server"
import { getLoadContext } from "./load-context"

export default await createHonoServer({
	configure(server) {
		server.use("*", i18next(i18nextOpts))
		
		// Let React Router handle 404s by not adding a custom notFound handler
		// The server will fall through to React Router's $.tsx catch-all route
	},
	defaultLogger: false,
	getLoadContext,
})
